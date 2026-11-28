import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { Course } from '../src/courses/course.entity.js';
import { SnapshotSummary } from '../src/courses/snapshots/course-snapshots.service.js';
import { GeneratedAiAccess } from '../src/mcp/ai-access.controller.js';
import {
  CreatedCourse,
  UploadedImage,
  WriteResult,
} from '../src/mcp/course-writer.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const EXERCISES = `## 1. QCM

> [!qcm] Autour des processus
>
> 1. Un processus est :
>    - [x] un programme en cours d'exécution
>    - [ ] un fichier

## 2. Exercices

> [!exercice] Exercice 1 : tourniquet
>
> Énoncé.
`;

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

describe('Serveur MCP : création d’un cours, documents entiers et exercices', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let url: URL;
  let token: string;
  let courseId: number;

  async function call(name: string, args: object): Promise<ToolResult> {
    const mcp = new Client({ name: 'essai', version: '1.0.0' });
    await mcp.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { 'X-API-Key': token } },
      }),
    );
    try {
      return (await mcp.callTool({
        name,
        arguments: { ...args },
      })) as ToolResult;
    } finally {
      await mcp.close();
    }
  }

  async function read(id = courseId): Promise<Course> {
    return (await client('get', `/api/courses/${id}`)).body as Course;
  }

  // Écrit dans le cours à sa révision courante.
  async function write(name: string, args: object): Promise<ToolResult> {
    const { revision } = await read();
    return call(name, { course: courseId, revision, ...args });
  }

  async function snapshots(): Promise<SnapshotSummary[]> {
    return (await client('get', `/api/courses/${courseId}/snapshots`))
      .body as SnapshotSummary[];
  }

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = new URL(`http://127.0.0.1:${port}/api/mcp`);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    const access = await client('post', '/api/ai-access').send({
      password: 'mot de passe long',
    });
    token = (access.body as GeneratedAiAccess).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crée un cours avec son texte, sans instantané', async () => {
    const result = await call('create_course', {
      ue: 'UTC502',
      title: '  Les processus  ',
      markdown: '## 1. Processus\n\nUn **processus** s’exécute.\n',
    });
    const created = JSON.parse(result.content[0].text) as CreatedCourse;
    courseId = created.course;
    const course = await read();

    expect(result.isError).toBeUndefined();
    expect(created).toMatchObject({
      ue: 'UTC502',
      title: 'Les processus',
      revision: course.revision,
    });
    expect(created.sections).toEqual([
      { id: expect.any(String) as string, level: 2, title: '1. Processus' },
    ]);
    expect(created.sections[0].id).toMatch(/^[a-z0-9]{8}$/);
    expect(course.position).toBe(1);
    expect(course.sheetContent).toBeNull();
    expect(await snapshots()).toEqual([]);
  });

  it('refuse de créer un cours dans une UE inconnue ou avec un exercice', async () => {
    const unknown = await call('create_course', { ue: 'XXX', title: 'Titre' });
    const withExercise = await call('create_course', {
      ue: 'UTC502',
      title: 'Titre',
      markdown: '> [!exercice] Exercice\n>\n> Énoncé.\n',
    });
    const courses = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];

    expect(unknown.isError).toBe(true);
    expect(withExercise.isError).toBe(true);
    expect(courses).toHaveLength(1);
  });

  it('pose une fiche que le cours n’avait pas, puis la remplace', async () => {
    const created = await write('set_course_document', {
      document: 'fiche',
      markdown: '## À retenir\n\nPremière version.\n',
    });
    const first = JSON.parse(created.content[0].text) as WriteResult;
    const replaced = await write('set_course_document', {
      document: 'fiche',
      markdown: '## À retenir\n\nSeconde version.\n\n## Pièges\n',
    });
    const second = JSON.parse(replaced.content[0].text) as WriteResult;
    const course = await read();

    expect(created.isError).toBeUndefined();
    expect(second.sections.map((section) => section.title)).toEqual([
      'À retenir',
      'Pièges',
    ]);
    expect(second.sections[0].id).toBe(first.sections[0].id);
    expect(JSON.stringify(course.sheetContent)).toContain('Seconde version.');
    expect(second.revision).toBe(first.revision + 1);
    expect((await snapshots()).map((snapshot) => snapshot.origin)).toEqual([
      'ai',
      'ai',
    ]);
  });

  it('refuse de poser le texte du cours en entier', async () => {
    const result = await write('set_course_document', {
      document: 'cours',
      markdown: '## Tout\n',
    });

    expect(result.isError).toBe(true);
  });

  it('pose les exercices, en ajoute, et rend leurs clés', async () => {
    const set = await write('set_course_document', {
      document: 'exercices',
      markdown: EXERCISES,
    });
    const added = await write('add_exercises', {
      markdown:
        '> [!exercice] Exercice 2 : priorités\n>\n> Énoncé.\n\n> [!qcm] Second QCM\n>\n> 1. Vrai ?\n>    - [x] oui\n>    - [ ] non\n',
    });
    const result = JSON.parse(added.content[0].text) as WriteResult;
    const refused = await write('add_exercises', {
      markdown: '## 3. Annales\n',
    });

    expect(set.isError).toBeUndefined();
    expect(result.document).toBe('exercices');
    expect(result.exercises).toEqual([
      { key: 'exercice-1-tourniquet', title: 'Exercice 1 : tourniquet' },
      { key: 'exercice-2-priorites', title: 'Exercice 2 : priorités' },
    ]);
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('insert_section');
  });

  it('crée les exercices d’un cours qui n’en a pas en y ajoutant un exercice', async () => {
    const other = await call('create_course', { ue: 'UTC502', title: 'Autre' });
    const { course, revision } = JSON.parse(
      other.content[0].text,
    ) as CreatedCourse;

    const added = await call('add_exercises', {
      course,
      revision,
      markdown: '> [!exercice] Seul\n>\n> Énoncé.\n',
    });

    expect(added.isError).toBeUndefined();
    expect(
      (await read(course)).exercisesContent?.content?.map(
        (block) => block.type,
      ),
    ).toEqual(['exercise']);
  });

  it('pose le corrigé d’un exercice sans toucher à son énoncé ni à ses réponses', async () => {
    const path = `/api/courses/${courseId}/exercises/exercice-1-tourniquet`;
    await client('put', `${path}/draft`).send({
      answer: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
        ],
      },
    });
    const before = await read();

    const written = await write('set_exercise_solution', {
      exercise: 'exercice-1-tourniquet',
      markdown: 'Le quantum vaut **2**.\n',
    });
    const unknown = await write('set_exercise_solution', {
      exercise: 'inconnu',
      markdown: 'Corrigé.\n',
    });
    const withTitle = await write('set_exercise_solution', {
      exercise: 'exercice-1-tourniquet',
      markdown: '## Titre\n',
    });
    const after = await read();
    const exerciseOf = (course: Course) =>
      course.exercisesContent?.content?.find(
        (block) => block.attrs?.['key'] === 'exercice-1-tourniquet',
      );

    expect(written.isError).toBeUndefined();
    expect(exerciseOf(after)?.content?.[0]).toEqual(
      exerciseOf(before)?.content?.[0],
    );
    expect(JSON.stringify(exerciseOf(after)?.content?.[1])).toContain(
      'Le quantum vaut ',
    );
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0].text).toContain('« inconnu »');
    expect(withTitle.isError).toBe(true);
    expect(after.revision).toBe(before.revision + 1);
  });

  it('enregistre un schéma SVG assaini, que l’écriture suivante place dans le cours', async () => {
    const uploaded = await call('upload_course_image', {
      course: courseId,
      svg: '<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10" onclick="x()"/></svg>',
      alt: 'Un carré plein',
    });
    const image = JSON.parse(uploaded.content[0].text) as UploadedImage;
    const before = await read();

    const written = await call('insert_section', {
      course: courseId,
      document: 'cours',
      revision: before.revision,
      markdown: `## 2. Schéma\n\n${image.markdown}\n`,
    });
    const stored = await client('get', image.src).buffer(true);
    const after = await read();

    expect(uploaded.isError).toBeUndefined();
    expect(image.src).toMatch(
      new RegExp(`^/api/courses/${courseId}/images/\\d+$`),
    );
    expect(image.markdown).toBe(`![Un carré plein](${image.src})`);
    expect(written.isError).toBeUndefined();
    expect(JSON.stringify(after.content)).toContain(image.src);
    expect(JSON.stringify(after.content)).toContain('"alt":"Un carré plein"');
    expect(stored.status).toBe(200);
    expect(String(stored.body)).toContain('<rect');
    expect(String(stored.body)).not.toMatch(/script|onclick/);
  });

  it('efface au prochain enregistrement un schéma qu’aucune écriture n’a placé', async () => {
    const uploaded = await call('upload_course_image', {
      course: courseId,
      svg: '<svg viewBox="0 0 1 1"></svg>',
      alt: 'Inutilisé',
    });
    const { src } = JSON.parse(uploaded.content[0].text) as UploadedImage;

    await write('insert_section', {
      document: 'cours',
      markdown: '## 3. Sans image\n',
    });

    expect((await client('get', src)).status).toBe(404);
  });

  it('refuse un texte qui n’est pas un SVG, un cours inconnu ou ouvert dans l’éditeur', async () => {
    const notSvg = await call('upload_course_image', {
      course: courseId,
      svg: '<html><svg></svg></html>',
      alt: 'Faux',
    });
    const unknown = await call('upload_course_image', {
      course: 999_999,
      svg: '<svg></svg>',
      alt: 'Nulle part',
    });
    await client('put', `/api/courses/${courseId}/editing`);
    const editing = await call('upload_course_image', {
      course: courseId,
      svg: '<svg></svg>',
      alt: 'Pendant l’édition',
    });
    await client('delete', `/api/courses/${courseId}/editing`);

    const brackets = await call('upload_course_image', {
      course: courseId,
      svg: '<svg></svg>',
      alt: 'Un carré [plein]',
    });

    expect(notSvg.isError).toBe(true);
    expect(notSvg.content[0].text).toContain('n’est pas un SVG');
    expect(brackets.isError).toBe(true);
    expect(brackets.content[0].text).toContain('ni crochet');
    expect(unknown.content[0].text).toBe('Ce cours n’existe pas.');
    expect(editing.isError).toBe(true);
    expect(editing.content[0].text).toContain('ouvert dans l’éditeur');
  });

  it('refuse de reposer les exercices sans un exercice qui a des réponses', async () => {
    const before = await read();

    const result = await write('set_course_document', {
      document: 'exercices',
      markdown: '> [!exercice] Autre exercice\n>\n> Énoncé.\n',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('exercice-1-tourniquet');
    expect(await read()).toEqual(before);
  });
});
