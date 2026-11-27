import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { markdownToContent } from '../src/courses/import/markdown-to-content.js';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { GeneratedAiAccess } from '../src/mcp/ai-access.controller.js';
import { AiAccessStatus } from '../src/mcp/ai-access.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';
import { saveCourse } from './save-course.js';

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'essai', version: '1.0.0' },
  },
};

const COURSE = `## 1. Processus

Un **processus** est un programme en cours d'exécution.

### 1.1 États

- Prêt
- Élu

## 2. Ordonnancement

Texte de la seconde section.
`;

const EXERCISES = `## 1. Exercices

> [!exercice] Exercice 1 : tourniquet
>
> Énoncé.
>
> > [!corrige]
> > Corrigé.
`;

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

describe('Serveur MCP', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let url: URL;
  let token: string;
  let courseId: number;

  async function generate(password = 'mot de passe long'): Promise<string> {
    const response = await client('post', '/api/ai-access').send({ password });
    expect(response.status).toBe(201);
    return (response.body as GeneratedAiAccess).token;
  }

  async function status(): Promise<AiAccessStatus | null> {
    const response = await client('get', '/api/ai-access');
    return (response.body as { access: AiAccessStatus | null }).access;
  }

  // Requête brute au point d'entrée, comme en envoie le connecteur.
  function post(sentToken?: string): request.Test {
    const sent = request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream');
    if (sentToken !== undefined) {
      void sent.set('X-API-Key', sentToken);
    }
    return sent.send(INITIALIZE);
  }

  // Vrai client MCP, celui du SDK, branché sur l'API en écoute.
  async function withMcp<T>(work: (mcp: Client) => Promise<T>): Promise<T> {
    const mcp = new Client({ name: 'essai', version: '1.0.0' });
    await mcp.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { 'X-API-Key': token } },
      }),
    );
    try {
      return await work(mcp);
    } finally {
      await mcp.close();
    }
  }

  async function call(name: string, args: object = {}): Promise<ToolResult> {
    return withMcp(
      (mcp) =>
        mcp.callTool({ name, arguments: { ...args } }) as Promise<ToolResult>,
    );
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
    courseId = (created.body as { id: number }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse la gestion du jeton sans session', async () => {
    const server = app.getHttpServer();

    const read = await request(server).get('/api/ai-access');
    const created = await request(server)
      .post('/api/ai-access')
      .send({ password: 'mot de passe long' });
    const removed = await request(server).delete('/api/ai-access');

    expect([read.status, created.status, removed.status]).toEqual([
      401, 401, 401,
    ]);
  });

  it('n’a aucun jeton au départ et refuse alors tout appel', async () => {
    expect(await status()).toBeNull();
    expect((await post('learn_inconnu')).status).toBe(401);
  });

  it('ne crée un jeton que sur confirmation du mot de passe', async () => {
    const wrong = await client('post', '/api/ai-access').send({
      password: 'mauvais',
    });
    const missing = await client('post', '/api/ai-access').send({});

    expect(wrong.status).toBe(403);
    expect((wrong.body as ErrorResponse).messages).toEqual([
      'Mot de passe incorrect.',
    ]);
    expect(missing.status).toBe(400);
    expect(await status()).toBeNull();
  });

  it('crée un jeton montré une seule fois, dont seule l’empreinte est enregistrée', async () => {
    token = await generate();

    expect(token).toMatch(/^learn_[\w-]{43}$/);
    expect(await status()).toEqual({
      createdAt: expect.any(String) as string,
      lastUsedAt: null,
    });
    const stored = await app
      .get(DataSource)
      .query<object[]>('SELECT * FROM ai_access_tokens');
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('refuse un appel sans jeton, avec un mauvais jeton ou avec la seule session', async () => {
    const anonymous = await post();
    const wrong = await post(`${token}x`);
    const withSession = await client('post', '/api/mcp').send(INITIALIZE);

    expect([anonymous.status, wrong.status, withSession.status]).toEqual([
      401, 401, 401,
    ]);
    expect((await status())?.lastUsedAt).toBeNull();
  });

  it('ne donne au jeton aucun accès au reste de l’API', async () => {
    const server = app.getHttpServer();
    const ues = await request(server).get('/api/ues').set('X-API-Key', token);
    const access = await request(server)
      .delete('/api/ai-access')
      .set('X-API-Key', token);
    const exported = await request(server)
      .get('/api/exports')
      .set('X-API-Key', token);

    expect([ues.status, access.status, exported.status]).toEqual([
      401, 401, 401,
    ]);
  });

  it('n’accepte que les requêtes POST', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/mcp')
      .set('X-API-Key', token);

    expect(response.status).toBe(405);
    expect(response.get('Allow')).toBe('POST');
  });

  it('annonce ses outils à un client MCP, tous en lecture seule', async () => {
    const { tools } = await withMcp((mcp) => mcp.listTools());

    expect(tools.map((tool) => tool.name)).toEqual([
      'list_ues',
      'list_courses',
      'get_course_outline',
      'read_course_document',
      'read_content_format',
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
    expect((await status())?.lastUsedAt).toEqual(expect.any(String));
  });

  it('liste les UE puis les cours d’une UE', async () => {
    const ues = await call('list_ues');
    const courses = await call('list_courses', { ue: 'UTC502' });

    expect(JSON.parse(ues.content[0].text)).toEqual([
      {
        code: 'UTC502',
        title: 'Systèmes',
        description: '',
        counts: { courses: 1, terms: 0, files: 0 },
      },
    ]);
    expect(JSON.parse(courses.content[0].text)).toEqual([
      {
        id: expect.any(Number) as number,
        title: 'Les processus',
        position: 1,
        sectionCount: 0,
        updatedAt: expect.any(String) as string,
      },
    ]);
  });

  it('donne le plan d’un cours, document par document, avec sa révision', async () => {
    const saved = await saveCourse(client, courseId, {
      content: markdownToContent(COURSE).document,
      exercisesContent: markdownToContent(EXERCISES).document,
    });
    expect(saved.status).toBe(200);

    const outline = await call('get_course_outline', { course: courseId });

    expect(JSON.parse(outline.content[0].text)).toEqual({
      id: courseId,
      ue: 'UTC502',
      title: 'Les processus',
      revision: 2,
      updatedAt: expect.any(String) as string,
      documents: {
        cours: {
          sections: [
            { rank: 1, level: 2, title: '1. Processus' },
            { rank: 2, level: 3, title: '1.1 États' },
            { rank: 3, level: 2, title: '2. Ordonnancement' },
          ],
        },
        fiche: null,
        exercices: {
          sections: [{ rank: 1, level: 2, title: '1. Exercices' }],
          exercises: [
            { key: 'exercice-1-tourniquet', title: 'Exercice 1 : tourniquet' },
          ],
        },
      },
    });
  });

  it('rend un document en Markdown, en entier ou une seule section', async () => {
    const whole = await call('read_course_document', {
      course: courseId,
      document: 'cours',
    });
    const section = await call('read_course_document', {
      course: courseId,
      document: 'cours',
      section: 1,
    });
    const exercises = await call('read_course_document', {
      course: courseId,
      document: 'exercices',
    });

    expect(whole.content[1].text).toBe(COURSE);
    expect(JSON.parse(whole.content[0].text)).toEqual({
      course: courseId,
      document: 'cours',
      revision: 2,
      losses: [],
    });
    expect(section.content[1].text).toBe(
      COURSE.slice(0, COURSE.indexOf('## 2.')).trimEnd() + '\n',
    );
    expect(JSON.parse(section.content[0].text)).toMatchObject({
      section: { rank: 1, level: 2, title: '1. Processus' },
    });
    expect(exercises.content[1].text).toBe(EXERCISES);
  });

  it('refuse un cours, un document ou une section qui n’existent pas', async () => {
    const course = await call('read_course_document', {
      course: courseId + 1000,
      document: 'cours',
    });
    const sheet = await call('read_course_document', {
      course: courseId,
      document: 'fiche',
    });
    const section = await call('read_course_document', {
      course: courseId,
      document: 'cours',
      section: 9,
    });
    const unknown = await call('read_course_document', {
      course: courseId,
      document: 'autre',
    });

    expect(course.content[0].text).toBe('Ce cours n’existe pas.');
    expect(sheet.content[0].text).toBe(
      'Ce cours n’a pas de fiche de révision.',
    );
    expect(section.content[0].text).toBe(
      'Ce document n’a pas de section de rang 9 : il en compte 3.',
    );
    expect(
      [course, sheet, section, unknown].every((result) => result.isError),
    ).toBe(true);
  });

  it('donne la référence du format du contenu', async () => {
    const format = await call('read_content_format');

    expect(format.isError).toBeUndefined();
    expect(format.content[0].text).toContain('# Contrats partagés');
    expect(format.content[0].text).toContain('[!exercice]');
  });

  it('rend un refus de l’application comme une erreur d’outil lisible', async () => {
    const unknown = await call('list_courses', { ue: 'INCONNUE' });
    const invalid = await call('list_courses', {});

    expect(unknown.isError).toBe(true);
    expect(unknown.content[0].text).toContain('UE');
    expect(invalid.isError).toBe(true);
  });

  it('révoque l’ancien jeton quand un nouveau est créé, puis le nouveau sur demande', async () => {
    const old = token;
    token = await generate();

    expect((await post(old)).status).toBe(401);
    expect((await post(token)).status).toBe(200);

    expect((await client('delete', '/api/ai-access')).status).toBe(204);
    expect((await post(token)).status).toBe(401);
    expect(await status()).toBeNull();
  });
});
