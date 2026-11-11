import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import { ImportPreview } from '../src/courses/import/course-import.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { createZip } from './create-zip.js';
import { resetDatabase } from './reset-database.js';

const MARKDOWN = readFileSync(
  new URL('../../contracts/cours.example.md', import.meta.url),
  'utf8',
);
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><rect width="10" height="10"/></svg>';
const TERMS = readFileSync(
  new URL('../../contracts/termes.example.json', import.meta.url),
  'utf8',
);

function validPackage(extra: Record<string, Buffer | string> = {}): Buffer {
  return createZip({
    'cours.md': MARKDOWN,
    'images/fig-01.svg': SVG,
    'termes.json': TERMS,
    ...extra,
  });
}

describe('Import d’un paquet de cours', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  const storageDirectory = join(process.env.UPLOADS_DIR ?? '', 'course-images');

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function preview(zip: Buffer): request.Test {
    return client('post', '/api/course-imports/preview').attach(
      'file',
      zip,
      'paquet.zip',
    );
  }

  function importPackage(zip: Buffer, replace = false): request.Test {
    return client('post', '/api/course-imports')
      .field('replace', String(replace))
      .attach('file', zip, 'paquet.zip');
  }

  function storedFiles(): string[] {
    return existsSync(storageDirectory) ? readdirSync(storageDirectory) : [];
  }

  async function countCourses(): Promise<number> {
    const response = await client('get', '/api/ues/UTC502/courses');
    return (response.body as Course[]).length;
  }

  async function expectRefusal(
    zip: Buffer,
    message: string | RegExp,
  ): Promise<void> {
    const response = await preview(zip);

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages.join('\n')).toMatch(
      message,
    );
  }

  async function readTerms(): Promise<object[]> {
    return app.get(DataSource).query<object[]>(
      `SELECT term.type, term.label, term.expanded_form, term.plain_text,
              ue.code AS ue_code, course.title AS course_title
         FROM terms term
         LEFT JOIN ues ue ON ue.id = term.ue_id
         LEFT JOIN courses course ON course.id = term.course_id
        ORDER BY term.id`,
    );
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/course-imports/preview')
      .attach('file', validPackage(), 'paquet.zip');

    expect(response.status).toBe(401);
  });

  it('donne un aperçu sans rien enregistrer', async () => {
    const response = await preview(validPackage());

    expect(response.status).toBe(200);
    expect(response.body).toEqual<ImportPreview>({
      ueCode: 'UTC502',
      title: 'Les processus : notions de base',
      position: 3,
      sectionCount: 2,
      imageCount: 1,
      termCount: 3,
      newTerms: [
        { type: 'definition', label: 'Processus' },
        { type: 'acronym', label: 'PCB' },
        { type: 'acronym', label: 'PID' },
      ],
      duplicateTerms: [],
      existingCourse: null,
    });
    expect(await countCourses()).toBe(0);
    expect(await readTerms()).toEqual([]);
    expect(storedFiles()).toEqual([]);
  });

  it('importe le cours, ses images assainies et son texte', async () => {
    const response = await importPackage(validPackage());

    expect(response.status).toBe(201);
    const course = response.body as Course;
    expect(course).toMatchObject({
      title: 'Les processus : notions de base',
      position: 3,
      ue: { code: 'UTC502' },
    });
    const figure = course.content.content?.find(
      (node) => node.type === 'figure',
    );
    expect(figure?.attrs).toEqual({
      src: expect.stringMatching(
        new RegExp(`^/api/courses/${course.id}/images/\\d+$`),
      ) as string,
      alt: "Schéma des trois états d'un processus",
    });
    const served = await client('get', String(figure?.attrs?.['src'])).buffer(
      true,
    );
    expect(served.status).toBe(200);
    expect((served.body as Buffer).toString('utf8')).not.toContain('onload');
    const kinds = course.content.content
      ?.filter((node) => node.type === 'callout')
      .map((node) => node.attrs?.['kind']);
    expect(kinds).toEqual(['retenir', 'change', 'attention']);
  });

  it('crée les termes du paquet, rattachés au cours et à son UE', async () => {
    const origin = {
      ue_code: 'UTC502',
      course_title: 'Les processus : notions de base',
    };

    expect(await readTerms()).toEqual([
      {
        type: 'definition',
        label: 'Processus',
        expanded_form: null,
        plain_text: expect.stringContaining('pid_t pid = fork();') as string,
        ...origin,
      },
      {
        type: 'acronym',
        label: 'PCB',
        expanded_form: 'Process Control Block',
        plain_text: 'Structure du noyau qui décrit un processus.',
        ...origin,
      },
      {
        type: 'acronym',
        label: 'PID',
        expanded_form: 'Process Identifier',
        plain_text: '',
        ...origin,
      },
    ]);
  });

  it('signale les termes déjà présents et ne les écrase pas', async () => {
    const terms = JSON.stringify([
      { type: 'definition', libelle: 'PROCESSUS', definition: 'Autre texte.' },
      {
        type: 'definition',
        libelle: 'PCB',
        definition: 'Homonyme du glossaire.',
      },
    ]);
    const zip = validPackage({
      'cours.md': MARKDOWN.replace('ordre: 3', 'ordre: 7'),
      'termes.json': terms,
    });

    const previewed = await preview(zip);
    expect(previewed.body).toMatchObject({
      termCount: 2,
      newTerms: [{ type: 'definition', label: 'PCB' }],
      duplicateTerms: [{ type: 'definition', label: 'PROCESSUS' }],
    });

    const imported = await importPackage(zip);
    expect(imported.status).toBe(201);
    // Les tests suivants comptent les cours : celui-ci n'en laisse pas.
    await client('delete', `/api/courses/${(imported.body as Course).id}`);
    const stored = (await readTerms()) as {
      label: string;
      plain_text: string;
    }[];
    expect(stored.map((term) => term.label)).toEqual([
      'Processus',
      'PCB',
      'PID',
      'PCB',
    ]);
    expect(stored[0].plain_text).toContain('Programme en cours d');
  });

  it('laisse le cours importé entièrement modifiable', async () => {
    const courses = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];
    const course = (await client('get', `/api/courses/${courses[0].id}`))
      .body as Course;

    const saved = await client('patch', `/api/courses/${course.id}`).send({
      content: course.content,
    });

    expect(saved.status).toBe(200);
  });

  it('signale le chapitre existant et demande confirmation avant de le remplacer', async () => {
    const again = await preview(validPackage());
    const refused = await importPackage(validPackage());

    expect((again.body as ImportPreview).existingCourse).toMatchObject({
      title: 'Les processus : notions de base',
    });
    expect(refused.status).toBe(409);
    expect((refused.body as ErrorResponse).messages).toEqual([
      'Un chapitre occupe déjà l’ordre 3 dans UTC502 : confirmez son remplacement.',
    ]);
  });

  it('remplace le chapitre et ses images quand c’est confirmé', async () => {
    const replaced = await importPackage(
      createZip({
        'cours.md': MARKDOWN.replace('notions de base', 'version 2'),
        'images/fig-01.svg': SVG,
      }),
      true,
    );

    expect(replaced.status).toBe(201);
    expect((replaced.body as Course).title).toBe('Les processus : version 2');
    expect(await countCourses()).toBe(1);
    expect(storedFiles()).toHaveLength(1);
  });

  it('accepte un paquet créé en compressant un dossier', async () => {
    const response = await preview(
      createZip({
        'chapitre-3/cours.md': MARKDOWN,
        'chapitre-3/images/fig-01.svg': SVG,
        '__MACOSX/chapitre-3/._cours.md': 'x',
        'chapitre-3/.DS_Store': 'x',
      }),
    );

    expect(response.status).toBe(200);
  });

  it('importe du Markdown collé, sans image', async () => {
    const markdown =
      '---\nue: UTC502\ntitre: Mémoire\nordre: 4\n---\n\n## 1. Pagination\n\nTexte.\n';

    const previewed = await client(
      'post',
      '/api/course-imports/markdown/preview',
    ).send({
      markdown,
    });
    const imported = await client('post', '/api/course-imports/markdown').send({
      markdown,
    });

    expect(previewed.body).toMatchObject({
      title: 'Mémoire',
      sectionCount: 1,
      imageCount: 0,
    });
    expect(imported.status).toBe(201);
    expect((imported.body as Course).position).toBe(4);
  });

  it.each([
    [
      'un fichier qui n’est pas un zip',
      Buffer.from('pas un zip'),
      /n’est pas une archive \.zip lisible/,
    ],
    [
      'un paquet sans cours.md',
      createZip({ 'images/fig-01.svg': SVG }),
      /ne contient pas de fichier cours\.md/,
    ],
    [
      'un fichier inattendu',
      validPackage({ 'virus.exe': 'x' }),
      /Fichier inattendu dans le paquet : « virus\.exe »/,
    ],
    [
      'une image absente',
      createZip({ 'cours.md': MARKDOWN }),
      /référence « images\/fig-01\.svg », absent du paquet/,
    ],
    [
      'une image qui n’en est pas une',
      validPackage({ 'images/fig-01.svg': '<html></html>' }),
      /images\/fig-01\.svg : Format non pris en charge/,
    ],
    [
      'une UE inconnue',
      validPackage({
        'cours.md': MARKDOWN.replace('ue: UTC502', 'ue: ABC123'),
      }),
      /L’UE ABC123 n’existe pas : créez-la d’abord/,
    ],
    [
      'un en-tête incomplet',
      validPackage({ 'cours.md': MARKDOWN.replace('ordre: 3\n', '') }),
      /champ « ordre »/,
    ],
    [
      'un titre de niveau 1',
      validPackage({ 'cours.md': `${MARKDOWN}\n# Trop haut\n` }),
      /cours\.md, ligne \d+ : titre de niveau 1 non pris en charge/,
    ],
    [
      'une entrée de termes.json invalide',
      validPackage({
        'cours.md': MARKDOWN.replace('ordre: 3', 'ordre: 8'),
        'termes.json': JSON.stringify([{ type: 'acronyme', libelle: 'CPU' }]),
      }),
      /termes\.json, entrée 1 : « forme_developpee » est requise/,
    ],
    [
      'un termes.json illisible',
      validPackage({ 'termes.json': '{' }),
      /termes\.json doit contenir une liste/,
    ],
  ])('refuse %s avec un message précis', async (_label, zip, message) => {
    await expectRefusal(zip, message);
  });

  it('n’enregistre rien quand l’import échoue', async () => {
    const before = {
      courses: await countCourses(),
      files: storedFiles().length,
    };

    const response = await importPackage(
      validPackage({
        'cours.md': MARKDOWN.replace('ordre: 3', 'ordre: 9').replace(
          '## 2.',
          '# 2.',
        ),
      }),
    );

    expect(response.status).toBe(400);
    expect({
      courses: await countCourses(),
      files: storedFiles().length,
    }).toEqual(before);
  });
});
