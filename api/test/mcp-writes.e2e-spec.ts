import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { ContentNode } from '../src/courses/content/content-node.js';
import { Course } from '../src/courses/course.entity.js';
import { markdownToContent } from '../src/courses/import/markdown-to-content.js';
import { SnapshotSummary } from '../src/courses/snapshots/course-snapshots.service.js';
import { GeneratedAiAccess } from '../src/mcp/ai-access.controller.js';
import { WriteResult } from '../src/mcp/course-writer.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';
import { saveCourse } from './save-course.js';

const COURSE = `## 1. Processus

Un **processus** est un programme en cours d'exécution.

### 1.1 États

- Prêt
- Élu

## 2. Ordonnancement

Texte de la seconde section.
`;

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

describe('Serveur MCP : écritures par section', () => {
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

  async function read(): Promise<Course> {
    return (await client('get', `/api/courses/${courseId}`)).body as Course;
  }

  function sectionId(document: ContentNode | null, title: string): string {
    const heading = (document?.content ?? []).find(
      (block) => block.type === 'heading' && block.content?.[0].text === title,
    );
    return String(heading?.attrs?.['id']);
  }

  // Écrit dans le cours ou ses exercices, à la révision courante sauf indication.
  async function write(
    name: string,
    args: object,
    document = 'cours',
  ): Promise<ToolResult> {
    const { revision } = await read();
    return call(name, { course: courseId, document, revision, ...args });
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
    const created = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Les processus',
    });
    courseId = (created.body as Course).id;
    await saveCourse(client, courseId, {
      content: markdownToContent(COURSE).document,
      exercisesContent: markdownToContent(EXERCISES).document,
    });
    const access = await client('post', '/api/ai-access').send({
      password: 'mot de passe long',
    });
    token = (access.body as GeneratedAiAccess).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('remplace une section sans toucher au reste, et garde l’état d’avant', async () => {
    const before = await read();
    const states = sectionId(before.content, '1.1 États');

    const result = await write('replace_section', {
      section: states,
      markdown: '### 1.1 Les trois états\n\n- Prêt\n- Élu\n- Bloqué\n',
    });
    const after = await read();
    const written = JSON.parse(result.content[0].text) as WriteResult;
    const snapshots = (
      await client('get', `/api/courses/${courseId}/snapshots`)
    ).body as SnapshotSummary[];

    expect(result.isError).toBeUndefined();
    expect(written).toEqual({
      course: courseId,
      document: 'cours',
      revision: before.revision + 1,
      sections: [
        expect.objectContaining({ title: '1. Processus' }),
        { id: states, level: 3, title: '1.1 Les trois états' },
        expect.objectContaining({ title: '2. Ordonnancement' }),
      ],
    });
    expect(after.content.content?.slice(0, 2)).toEqual(
      before.content.content?.slice(0, 2),
    );
    expect(after.content.content?.slice(-2)).toEqual(
      before.content.content?.slice(-2),
    );
    expect(after.exercisesContent).toEqual(before.exercisesContent);
    expect(snapshots[0]).toMatchObject({
      origin: 'ai',
      revision: before.revision,
    });

    const restored = await client(
      'post',
      `/api/courses/${courseId}/snapshots/${snapshots[0].id}/restore`,
    ).send({ revision: after.revision });
    expect((restored.body as Course).content).toEqual(before.content);
  });

  it('met à jour le texte de recherche du cours', async () => {
    const { content } = await read();
    await write('replace_section', {
      section: sectionId(content, '2. Ordonnancement'),
      markdown: '## 2. Ordonnancement\n\nLe tourniquet partage le temps.\n',
    });

    const found = await client('get', '/api/search?q=tourniquet');

    expect((found.body as { courses: { total: number } }).courses.total).toBe(
      1,
    );
  });

  it('insère une section après une autre ou à la fin, puis la supprime', async () => {
    const { content } = await read();
    const inserted = await write('insert_section', {
      after: sectionId(content, '1. Processus'),
      markdown: '## 1 bis. Threads\n\nUn fil d’exécution.\n',
    });
    const appended = await write('insert_section', {
      markdown: '## 3. Synthèse\n\nÀ retenir.\n',
    });
    const titles = (result: ToolResult): string[] =>
      (JSON.parse(result.content[0].text) as WriteResult).sections.map(
        (section) => section.title,
      );

    expect(titles(inserted)).toEqual([
      '1. Processus',
      '1.1 États',
      '1 bis. Threads',
      '2. Ordonnancement',
    ]);
    expect(titles(appended).at(-1)).toBe('3. Synthèse');

    const removed = await write('delete_section', {
      section: sectionId((await read()).content, '1 bis. Threads'),
    });
    expect(titles(removed)).not.toContain('1 bis. Threads');
  });

  it('refuse un Markdown invalide avec un message qui dit quoi corriger', async () => {
    const before = await read();
    const section = sectionId(before.content, '1.1 États');
    const attempt = (markdown: string): Promise<ToolResult> =>
      write('replace_section', { section, markdown });

    const noHeading = await attempt('Sans titre.\n');
    const wrongLevel = await attempt('## 1.1 États\n');
    const quiz = await attempt(
      '### 1.1 États\n\n> [!qcm]\n>\n> 1. Q\n>    - [x] a\n>    - [ ] b\n',
    );
    const callout = await attempt('### 1.1 États\n\n> [!inconnu]\n> Texte.\n');
    const image = await attempt('### 1.1 États\n\n![x](images/fig-01.svg)\n');
    const foreign = await attempt(
      `### 1.1 États\n\n![x](/api/courses/${courseId}/images/999999)\n`,
    );
    const unknown = await write('replace_section', {
      section: 'inconnue',
      markdown: '## Titre\n',
    });

    expect(noHeading.content[0].text).toContain('commence par son titre');
    expect(wrongLevel.content[0].text).toContain('niveau 3');
    expect(quiz.content[0].text).toBe(
      'Un QCM ou un exercice se place dans les exercices du cours, pas ailleurs.',
    );
    expect(callout.content[0].text).toContain(
      'Markdown, ligne 3 : type d’encadré inconnu « inconnu »',
    );
    expect(image.content[0].text).toContain('telle que la lecture la donne');
    expect(foreign.content[0].text).toBe(
      'Le contenu référence une image qui n’appartient pas à ce cours.',
    );
    expect(unknown.content[0].text).toContain('pas de section « inconnue »');
    expect(
      [noHeading, wrongLevel, quiz, callout, image, foreign, unknown].every(
        (result) => result.isError,
      ),
    ).toBe(true);
    expect(await read()).toEqual(before);
  });

  it('refuse une écriture partie d’une révision dépassée', async () => {
    const before = await read();

    const result = await call('insert_section', {
      course: courseId,
      document: 'cours',
      revision: before.revision - 1,
      markdown: '## Trop tard\n',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('modifié depuis son ouverture');
    expect(await read()).toEqual(before);
  });

  it('refuse d’écrire dans un cours ouvert dans l’éditeur', async () => {
    await client('put', `/api/courses/${courseId}/editing`);
    const before = await read();

    const result = await write('insert_section', { markdown: '## Pendant\n' });
    await client('delete', `/api/courses/${courseId}/editing`);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ouvert dans l’éditeur');
    expect(await read()).toEqual(before);
  });

  it('refuse d’écrire dans un document que le cours n’a pas', async () => {
    const result = await write(
      'insert_section',
      { markdown: '## Fiche\n' },
      'fiche',
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      'Ce cours n’a pas de fiche de révision.',
    );
  });

  it('garde la clé d’un exercice réécrit, et refuse de perdre des réponses', async () => {
    const path = `/api/courses/${courseId}/exercises`;
    await client('post', `${path}/qcm-1/attempts`).send({
      kind: 'quiz',
      score: 1,
      maxScore: 1,
    });
    await client('put', `${path}/exercice-1-tourniquet/draft`).send({
      answer: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
        ],
      },
    });
    const before = await read();
    const exercises = sectionId(before.exercisesContent, '2. Exercices');
    const quizzes = sectionId(before.exercisesContent, '1. QCM');

    const rewritten = await write(
      'replace_section',
      {
        section: exercises,
        markdown:
          '## 2. Exercices\n\n> [!exercice] Exercice 1 : tourniquet\n>\n> Énoncé corrigé.\n>\n> > [!corrige]\n> > Le corrigé.\n',
      },
      'exercices',
    );
    const renamed = await write(
      'replace_section',
      {
        section: exercises,
        markdown:
          '## 2. Exercices\n\n> [!exercice] Autre titre\n>\n> Énoncé.\n',
      },
      'exercices',
    );
    const withoutQuiz = await write(
      'delete_section',
      { section: quizzes },
      'exercices',
    );
    const after = await read();

    expect(rewritten.isError).toBeUndefined();
    expect(
      after.exercisesContent?.content?.find(
        (block) => block.type === 'exercise',
      )?.attrs,
    ).toEqual({
      title: 'Exercice 1 : tourniquet',
      key: 'exercice-1-tourniquet',
    });
    expect(renamed.isError).toBe(true);
    expect(renamed.content[0].text).toContain(
      'ferait perdre des réponses déjà enregistrées (exercice-1-tourniquet)',
    );
    expect(withoutQuiz.isError).toBe(true);
    expect(withoutQuiz.content[0].text).toContain('qcm-1');
    expect(after.revision).toBe(before.revision + 1);
  });
});
