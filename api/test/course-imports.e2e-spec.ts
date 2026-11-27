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
import { saveCourse } from './save-course.js';

const MARKDOWN = readFileSync(
  new URL('../../contracts/cours.example.md', import.meta.url),
  'utf8',
);
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><rect width="10" height="10"/></svg>';
const SHEET = readFileSync(
  new URL('../../contracts/fiche.example.md', import.meta.url),
  'utf8',
);
const TERMS = readFileSync(
  new URL('../../contracts/termes.example.json', import.meta.url),
  'utf8',
);

function validPackage(extra: Record<string, Buffer | string> = {}): Buffer {
  return createZip({
    'cours.md': MARKDOWN,
    'images/fig-01.svg': SVG,
    'images/def-commutation-01.svg': SVG,
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

  function importPackage(
    zip: Buffer,
    replace = false,
    replaceTerms = false,
  ): request.Test {
    return client('post', '/api/course-imports')
      .field('replace', String(replace))
      .field('replaceTerms', String(replaceTerms))
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
      termCount: 4,
      termImageCount: 1,
      newTerms: [
        { type: 'definition', label: 'Processus' },
        { type: 'acronym', label: 'PCB' },
        { type: 'acronym', label: 'PID' },
        { type: 'definition', label: 'Commutation de contexte' },
      ],
      duplicateTerms: [],
      hasSheet: false,
      sheetImageCount: 0,
      hasExercises: false,
      sourceCount: 0,
      commands: {
        newTools: [],
        existingTools: [],
        newCommands: [],
        duplicateCommands: [],
      },
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
      // « ordre: 3 » dans une UE vide : le chapitre est le premier.
      position: 1,
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
    expect(kinds).toEqual([
      'retenir',
      'change',
      'attention',
      'definition',
      'savoir',
      'noter',
      'astuce',
    ]);
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
      {
        type: 'definition',
        label: 'Commutation de contexte',
        expanded_form: null,
        plain_text: expect.stringContaining(
          'Sauvegarde des registres',
        ) as string,
        ...origin,
      },
    ]);
  });

  it('enregistre l’image d’une définition riche, assainie et rattachée au terme', async () => {
    const terms = (await client('get', '/api/terms?type=definition')).body as {
      id: number;
      label: string;
    }[];
    const { id } = terms.find(
      (term) => term.label === 'Commutation de contexte',
    ) ?? { id: 0 };
    const term = (await client('get', `/api/terms/${id}`)).body as Course;

    expect(term.content.content?.map((block) => block.type)).toEqual([
      'paragraph',
      'figure',
      'table',
      'callout',
    ]);
    const figure = term.content.content?.[1];
    expect(figure?.attrs).toEqual({
      src: expect.stringMatching(
        new RegExp(`^/api/terms/${id}/images/\\d+$`),
      ) as string,
      alt: 'Deux processus qui se partagent le processeur',
    });
    const served = await client('get', String(figure?.attrs?.['src'])).buffer(
      true,
    );
    expect(served.status).toBe(200);
    expect((served.body as Buffer).toString('utf8')).not.toContain('onload');
    // Le terme importé reste modifiable : sa définition est acceptée telle quelle.
    const saved = await client('patch', `/api/terms/${id}`).send({
      content: term.content,
    });
    expect(saved.status).toBe(200);
    expect(storedFiles()).toHaveLength(2);
  });

  it('importe toujours un paquet à l’ancien format, sans image de définition', async () => {
    const zip = createZip({
      'cours.md': MARKDOWN.replace('notions de base', 'ancien format'),
      'images/fig-01.svg': SVG,
      'termes.json': JSON.stringify([
        { type: 'definition', libelle: 'Fil', definition: 'Texte **simple**.' },
      ]),
    });

    const previewed = await preview(zip);
    const imported = await importPackage(zip);

    expect(previewed.body).toMatchObject({ termCount: 1, termImageCount: 0 });
    expect(imported.status).toBe(201);
    // Les tests suivants comptent les cours et les termes : celui-ci n'en laisse pas.
    await client('delete', `/api/courses/${(imported.body as Course).id}`);
    await app.get(DataSource).query(`DELETE FROM terms WHERE label = 'Fil'`);
  });

  it('n’enregistre pas les images d’un terme déjà présent', async () => {
    const zip = validPackage({
      'cours.md': MARKDOWN.replace('notions de base', 'réimport'),
    });

    const previewed = await preview(zip);
    const imported = await importPackage(zip);

    expect(previewed.body).toMatchObject({
      termImageCount: 0,
      newTerms: [],
    });
    expect(imported.status).toBe(201);
    await client('delete', `/api/courses/${(imported.body as Course).id}`);
    expect(storedFiles()).toHaveLength(2);
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
      'cours.md': MARKDOWN.replace('notions de base', 'deuxième partie'),
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
      'Commutation de contexte',
      'PCB',
    ]);
    expect(stored[0].plain_text).toContain('Programme en cours d');
  });

  it('ne prend pas pour doublon le terme de même libellé d’une autre UE', async () => {
    await client('post', '/api/ues').send({
      code: 'NFE108',
      title: 'Méthodes',
    });
    const other = await client('post', '/api/terms').send({
      type: 'definition',
      label: 'Sémaphore',
      ueCode: 'NFE108',
    });
    const zip = validPackage({
      'termes.json': JSON.stringify([
        { type: 'definition', libelle: 'Sémaphore', definition: 'Compteur.' },
      ]),
    });

    const previewed = await preview(zip);

    expect(previewed.body).toMatchObject({
      newTerms: [{ type: 'definition', label: 'Sémaphore' }],
      duplicateTerms: [],
    });
    // Les tests suivants comptent les termes et les UE : celui-ci n'en laisse pas.
    await client('delete', `/api/terms/${(other.body as { id: number }).id}`);
    await client('delete', '/api/ues/NFE108');
  });

  it('remplace sur demande la définition et les images des termes déjà présents', async () => {
    const terms = JSON.stringify([
      {
        type: 'definition',
        libelle: 'COMMUTATION DE CONTEXTE',
        definition: 'Version revue.\n\n![Nouveau schéma](images/def-revu.svg)',
      },
      {
        type: 'acronyme',
        libelle: 'PID',
        forme_developpee: 'Process IDentifier',
        definition: 'Numéro du processus.',
      },
    ]);
    const zip = createZip({
      'cours.md': MARKDOWN.replace('notions de base', 'révision'),
      'images/fig-01.svg': SVG,
      'images/def-revu.svg': SVG,
      'termes.json': terms,
    });
    const filesBefore = storedFiles();

    const imported = await importPackage(zip, false, true);

    expect(imported.status).toBe(201);
    const rows = await app.get(DataSource).query<
      {
        id: number;
        label: string;
        expanded_form: string | null;
        plain_text: string;
        content: Course['content'];
        course_title: string;
      }[]
    >(
      `SELECT term.id, term.label, term.expanded_form, term.plain_text, term.content,
              course.title AS course_title
         FROM terms term JOIN courses course ON course.id = term.course_id
        WHERE term.label IN ('Commutation de contexte', 'PID')
        ORDER BY term.label`,
    );
    // Le libellé garde sa casse d'origine ; le reste vient du paquet.
    expect(rows).toMatchObject([
      {
        label: 'Commutation de contexte',
        plain_text: expect.stringContaining('Version revue.') as string,
        course_title: 'Les processus : révision',
      },
      {
        label: 'PID',
        expanded_form: 'Process IDentifier',
        plain_text: 'Numéro du processus.',
      },
    ]);
    const figure = rows[0].content.content?.[1];
    expect(figure?.attrs?.['alt']).toBe('Nouveau schéma');
    const served = await client('get', String(figure?.attrs?.['src']));
    expect(served.status).toBe(200);
    const images = await app
      .get(DataSource)
      .query<object[]>('SELECT id FROM term_images WHERE term_id = $1', [
        rows[0].id,
      ]);
    expect(images).toHaveLength(1);
    // L'ancienne image du terme est effacée ; s'ajoutent celle du cours et la nouvelle.
    const filesAfter = storedFiles();
    expect(filesAfter).toHaveLength(filesBefore.length + 1);
    expect(
      filesBefore.filter((name) => !filesAfter.includes(name)),
    ).toHaveLength(1);
    await client('delete', `/api/courses/${(imported.body as Course).id}`);
  });

  it('refuse une valeur invalide pour le remplacement des termes', async () => {
    const response = await client('post', '/api/course-imports')
      .field('replaceTerms', 'peut-être')
      .attach('file', validPackage(), 'paquet.zip');

    expect(response.status).toBe(400);
  });

  it('laisse le cours importé entièrement modifiable', async () => {
    const courses = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];
    const course = (await client('get', `/api/courses/${courses[0].id}`))
      .body as Course;

    const saved = await saveCourse(client, course.id, {
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
      'Le chapitre « Les processus : notions de base » existe déjà dans UTC502 : confirmez son remplacement.',
    ]);
  });

  it('refuse de remplacer un chapitre ouvert dans l’éditeur, jusqu’à sa fermeture ou l’expiration', async () => {
    const dataSource = app.get(DataSource);
    const [{ id }] = await dataSource.query<{ id: number }[]>(
      'SELECT id FROM courses',
    );
    const path = `/api/courses/${id}/editing`;

    const opened = await client('put', path);
    const refused = await importPackage(validPackage(), true);
    const closed = await client('delete', path);
    const accepted = await importPackage(validPackage(), true);
    // Un éditeur fermé sans prévenir : le délai passé, le cours est libre.
    await client('put', path);
    await dataSource.query(
      `UPDATE courses SET editing_until = now() - interval '1 second'`,
    );
    const expired = await importPackage(validPackage(), true);

    expect([opened.status, closed.status]).toEqual([204, 204]);
    expect(refused.status).toBe(409);
    expect((refused.body as ErrorResponse).messages).toEqual([
      'Ce cours est ouvert dans l’éditeur. Fermez-le avant de le modifier autrement.',
    ]);
    expect([accepted.status, expired.status]).toEqual([201, 201]);
  });

  it('remplace le chapitre et ses images quand c’est confirmé', async () => {
    const [before] = await app
      .get(DataSource)
      .query<{ id: number; revision: number; content: object }[]>(
        'SELECT id, revision, content FROM courses',
      );
    // Même titre, à la casse près, et un autre « ordre » : c'est le titre qui désigne le chapitre.
    const replaced = await importPackage(
      createZip({
        'cours.md': MARKDOWN.replace('notions de base', 'NOTIONS DE BASE')
          .replace('ordre: 3', 'ordre: 9')
          .replace('## 2. Ordonnancement', '## 2. Ordonnancement revu'),
        'images/fig-01.svg': SVG,
      }),
      true,
    );

    expect(replaced.status).toBe(201);
    const course = replaced.body as Course;
    expect(course.title).toBe('Les processus : NOTIONS DE BASE');
    // Un éditeur resté ouvert sur l'ancienne version ne peut plus l'écraser.
    expect([course.id, course.revision]).toEqual([
      before.id,
      before.revision + 1,
    ]);
    expect(course.position).toBe(1);
    expect(JSON.stringify(course.content)).toContain('Ordonnancement revu');
    expect(await countCourses()).toBe(1);
    // Les images du chapitre remplacé restent, pour son instantané ; le paquet apporte la sienne.
    const figure = /\/api\/courses\/\d+\/images\/\d+/;
    const oldFigure = figure.exec(JSON.stringify(before.content))![0];
    const newFigure = figure.exec(JSON.stringify(course.content))![0];
    expect(newFigure).not.toBe(oldFigure);
    expect((await client('get', oldFigure)).status).toBe(200);
    expect((await client('get', newFigure)).status).toBe(200);
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
    // « ordre: 4 » dépasse le nombre de chapitres : le nouveau se place à la fin.
    expect((imported.body as Course).position).toBe(2);
  });

  it('place un nouveau chapitre au rang demandé et décale les suivants', async () => {
    const markdown =
      '---\nue: UTC502\ntitre: Introduction\nordre: 1\n---\n\n## 1. Plan\n\nTexte.\n';

    const imported = await client('post', '/api/course-imports/markdown').send({
      markdown,
    });

    expect(imported.status).toBe(201);
    const listed = await client('get', '/api/ues/UTC502/courses');
    expect(
      (listed.body as Course[]).map((course) => [
        course.position,
        course.title,
      ]),
    ).toEqual([
      [1, 'Introduction'],
      [2, 'Les processus : NOTIONS DE BASE'],
      [3, 'Mémoire'],
    ]);
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
      'une image de définition absente',
      createZip({
        'cours.md': MARKDOWN,
        'images/fig-01.svg': SVG,
        'termes.json': TERMS,
      }),
      /termes\.json, « Commutation de contexte » référence « images\/def-commutation-01\.svg », absent du paquet/,
    ],
    [
      'une image de définition qui n’en est pas une',
      validPackage({ 'images/def-commutation-01.svg': '<html></html>' }),
      /images\/def-commutation-01\.svg : Format non pris en charge/,
    ],
    [
      'un termes.json illisible',
      validPackage({ 'termes.json': '{' }),
      /termes\.json doit contenir une liste/,
    ],
  ])('refuse %s avec un message précis', async (_label, zip, message) => {
    await expectRefusal(zip, message);
  });

  describe('fiche de révision', () => {
    const MARKDOWN_FICHE =
      '---\nue: UTC502\ntitre: Chapitre à fiche\nordre: 9\n---\n\n## Bases\n\nTexte.';
    const withSheet = (): Buffer =>
      createZip({
        'cours.md': MARKDOWN_FICHE,
        'fiche.md': SHEET,
        'images/fiche-01.svg': SVG,
      });
    const withoutSheet = (): Buffer =>
      createZip({ 'cours.md': MARKDOWN_FICHE });

    function figureOf(course: Course): string {
      const figure = course.sheetContent?.content?.find(
        (node) => node.type === 'figure',
      );
      return String(figure?.attrs?.['src']);
    }

    it('annonce la fiche du paquet dans l’aperçu', async () => {
      const response = await preview(withSheet());

      expect(response.body).toMatchObject({
        hasSheet: true,
        sheetImageCount: 1,
        existingCourse: null,
      });
    });

    it('importe la fiche avec ses images, rattachées au cours', async () => {
      const response = await importPackage(withSheet());

      expect(response.status).toBe(201);
      const course = response.body as Course;
      const types = course.sheetContent?.content?.map((node) => node.type);
      expect(types).toEqual([
        'heading',
        'paragraph',
        'figure',
        'table',
        'callout',
        'heading',
        'orderedList',
        'codeBlock',
        'callout',
      ]);
      expect(figureOf(course)).toMatch(
        new RegExp(`^/api/courses/${course.id}/images/\\d+$`),
      );
      const served = await client('get', figureOf(course)).buffer(true);
      expect(served.status).toBe(200);
      expect((served.body as Buffer).toString('utf8')).not.toContain('onload');
    });

    it('garde la fiche et ses images quand le paquet réimporté n’en a pas', async () => {
      const announced = await preview(withoutSheet());
      expect(announced.body).toMatchObject({
        hasSheet: false,
        existingCourse: { hasSheet: true },
      });

      const response = await importPackage(withoutSheet(), true);

      const course = response.body as Course;
      expect(course.sheetContent?.content).toHaveLength(9);
      expect((await client('get', figureOf(course))).status).toBe(200);
    });

    it('remplace la fiche au réimport et garde ses anciennes images pour l’instantané', async () => {
      const before = (await importPackage(withoutSheet(), true)).body as Course;
      const oldFigure = figureOf(before);

      const response = await importPackage(withSheet(), true);

      const course = response.body as Course;
      expect(figureOf(course)).not.toBe(oldFigure);
      expect((await client('get', oldFigure)).status).toBe(200);
      expect((await client('get', figureOf(course))).status).toBe(200);
    });

    it('refuse une fiche vide, invalide ou dont une image manque', async () => {
      await expectRefusal(
        createZip({ 'cours.md': MARKDOWN_FICHE, 'fiche.md': '  \n' }),
        'fiche.md est vide.',
      );
      await expectRefusal(
        createZip({ 'cours.md': MARKDOWN_FICHE, 'fiche.md': '> [!note]\n> x' }),
        /fiche\.md.*type d’encadré inconnu « note »/,
      );
      await expectRefusal(
        createZip({ 'cours.md': MARKDOWN_FICHE, 'fiche.md': SHEET }),
        'fiche.md référence « images/fiche-01.svg », absent du paquet.',
      );
    });
  });

  describe('exercices', () => {
    const MARKDOWN_EXERCICES =
      '---\nue: UTC502\ntitre: Chapitre à exercices\nordre: 9\n---\n\n## Bases\n\nTexte.';
    const QUIZ =
      '> [!qcm] Bases\n>\n> 1. Vrai ?\n>    - [x] oui\n>    - [ ] non';
    const EXERCISES = `## 1. QCM\n\n${QUIZ}\n\n## 2. Exercice\n\n> [!exercice] Exercice 1\n>\n> Calculez.\n>\n> > [!corrige]\n> > 42.`;
    const withExercises = (): Buffer =>
      createZip({ 'cours.md': MARKDOWN_EXERCICES, 'exercices.md': EXERCISES });
    const withoutExercises = (): Buffer =>
      createZip({ 'cours.md': MARKDOWN_EXERCICES });

    it('annonce les exercices du paquet dans l’aperçu', async () => {
      const response = await preview(withExercises());

      expect(response.body).toMatchObject({
        hasExercises: true,
        existingCourse: null,
      });
    });

    it('importe les exercices dans leur document, à part du cours', async () => {
      const response = await importPackage(withExercises());

      expect(response.status).toBe(201);
      const course = response.body as Course;
      expect(
        course.exercisesContent?.content?.map((node) => node.type),
      ).toEqual(['heading', 'quiz', 'heading', 'exercise']);
      expect(course.content.content?.map((node) => node.type)).toEqual([
        'heading',
        'paragraph',
      ]);
    });

    it('garde les exercices quand le paquet réimporté n’en a pas', async () => {
      const announced = await preview(withoutExercises());
      expect(announced.body).toMatchObject({
        hasExercises: false,
        existingCourse: { hasExercises: true },
      });

      const response = await importPackage(withoutExercises(), true);

      expect((response.body as Course).exercisesContent?.content).toHaveLength(
        4,
      );
    });

    it('refuse un QCM ou un exercice écrit dans cours.md ou dans fiche.md', async () => {
      await expectRefusal(
        createZip({ 'cours.md': `${MARKDOWN_EXERCICES}\n\n${QUIZ}` }),
        'cours.md : un QCM ou un exercice se place dans exercices.md, pas dans cours.md.',
      );
      await expectRefusal(
        createZip({ 'cours.md': MARKDOWN_EXERCICES, 'fiche.md': QUIZ }),
        'fiche.md : un QCM ou un exercice se place dans exercices.md, pas dans fiche.md.',
      );
    });

    it('refuse des exercices vides ou invalides', async () => {
      await expectRefusal(
        createZip({ 'cours.md': MARKDOWN_EXERCICES, 'exercices.md': '  \n' }),
        'exercices.md est vide.',
      );
      await expectRefusal(
        createZip({
          'cours.md': MARKDOWN_EXERCICES,
          'exercices.md': '> [!qcm]\n>\n> Texte.',
        }),
        /exercices\.md.*liste numérotée/,
      );
    });
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
