import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Tool } from '../src/tools/tool.entity.js';
import { ToolSummary } from '../src/tools/tools.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Système des routeurs Cisco.' }],
    },
  ],
};

describe('Outils', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let client: AuthenticatedClient;
  let iosId: number;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(dataSource);
    client = await createAuthenticatedClient(app);
    for (const code of ['UTC505', 'UTC502']) {
      await client('post', '/api/ues').send({ code, title: code });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function messages(response: { body: unknown }): string {
    return (response.body as ErrorResponse).messages.join(' ');
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get('/api/tools');

    expect(response.status).toBe(401);
  });

  it('crée un outil avec sa fiche, ses modes, ses déclinaisons et ses UE', async () => {
    const response = await client('post', '/api/tools').send({
      name: '  Cisco IOS ',
      summary: 'Terminal des routeurs et commutateurs Cisco.',
      content: CONTENT,
      ueCodes: ['utc505'],
      modes: [
        { name: 'Utilisateur', prompt: 'Router>' },
        { name: 'Privilégié', prompt: 'Router#', entry: 'enable' },
      ],
      variants: [{ name: 'IOS' }, { name: 'IOS-XE' }],
    });

    expect(response.status).toBe(201);
    const tool = response.body as Tool;
    iosId = tool.id;
    expect(tool.name).toBe('Cisco IOS');
    expect(tool.content).toEqual(CONTENT);
    expect(tool.ues.map((ue) => ue.code)).toEqual(['UTC505']);
    expect(tool.modes).toMatchObject([
      { name: 'Utilisateur', prompt: 'Router>', entry: '', position: 1 },
      { name: 'Privilégié', prompt: 'Router#', entry: 'enable', position: 2 },
    ]);
    expect(tool.variants.map((variant) => variant.name)).toEqual([
      'IOS',
      'IOS-XE',
    ]);
    const [{ plain_text: plainText }] = await dataSource.query<
      { plain_text: string }[]
    >('SELECT plain_text FROM tools WHERE id = $1', [iosId]);
    expect(plainText).toBe('Système des routeurs Cisco.');
  });

  it('crée un outil réduit à son nom', async () => {
    const response = await client('post', '/api/tools').send({ name: 'bash' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'bash',
      summary: '',
      modes: [],
      variants: [],
      ues: [],
    });
  });

  it('liste les outils par ordre alphabétique, avec leurs UE', async () => {
    const response = await client('get', '/api/tools');

    expect(response.status).toBe(200);
    expect(response.body as ToolSummary[]).toEqual([
      expect.objectContaining({ name: 'bash', ueCodes: [] }),
      expect.objectContaining({ name: 'Cisco IOS', ueCodes: ['UTC505'] }),
    ]);
  });

  it('met à jour les modes en gardant le numéro de ceux qui restent', async () => {
    const before = (await client('get', `/api/tools/${iosId}`)).body as Tool;
    const privileged = before.modes[1];

    const response = await client('patch', `/api/tools/${iosId}`).send({
      modes: [
        { name: 'Configuration', prompt: 'Router(config)#' },
        { id: privileged.id, name: 'Privilégié', prompt: 'Router#' },
      ],
      ueCodes: ['UTC502', 'UTC505'],
    });

    expect(response.status).toBe(200);
    const tool = response.body as Tool;
    expect(tool.modes.map((mode) => mode.name)).toEqual([
      'Configuration',
      'Privilégié',
    ]);
    expect(tool.modes[1].id).toBe(privileged.id);
    expect(tool.modes[1].entry).toBe('');
    expect(tool.ues).toHaveLength(2);
    // Les champs absents de la demande ne changent pas.
    expect(tool.variants).toHaveLength(2);
    expect(tool.summary).toBe('Terminal des routeurs et commutateurs Cisco.');
    const [{ count }] = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM tool_modes WHERE tool_id = $1',
      [iosId],
    );
    expect(count).toBe(2);
  });

  it('refuse un nom déjà pris, sans tenir compte de la casse', async () => {
    const response = await client('post', '/api/tools').send({ name: 'BASH' });

    expect(response.status).toBe(409);
    expect(messages(response)).toContain('existe déjà');
  });

  it('refuse une entrée invalide', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ name: ' ' }, 'Le nom est requis'],
      [{ name: 'git', inconnu: true }, 'inconnu'],
      [{ name: 'git', ueCodes: ['XXX000'] }, 'XXX000'],
      [{ name: 'git', modes: [{ name: '' }] }, 'nom d’un mode'],
      [{ name: 'git', modes: [{ id: 9999, name: 'Autre' }] }, 'n’appartient'],
      [{ name: 'git', variants: [{ name: 'a' }, { name: 'A' }] }, 'nom « A »'],
      [
        {
          name: 'git',
          content: { type: 'doc', content: [{ type: 'script' }] },
        },
        'script',
      ],
      [
        {
          name: 'git',
          content: {
            type: 'doc',
            content: [
              {
                type: 'figure',
                attrs: { src: '/api/courses/1/images/1', alt: '' },
              },
            ],
          },
        },
        'image',
      ],
    ];
    for (const [body, expected] of cases) {
      const response = await client('post', '/api/tools').send(body);

      expect(response.status).toBe(400);
      expect(messages(response)).toContain(expected);
    }
  });

  it('garde l’outil quand une de ses UE est supprimée', async () => {
    await client('delete', '/api/ues/UTC502');

    const response = await client('get', `/api/tools/${iosId}`);

    expect((response.body as Tool).ues.map((ue) => ue.code)).toEqual([
      'UTC505',
    ]);
  });

  it('supprime un outil avec ses modes et ses déclinaisons', async () => {
    const response = await client('delete', `/api/tools/${iosId}`);

    expect(response.status).toBe(204);
    expect((await client('get', `/api/tools/${iosId}`)).status).toBe(404);
    const [{ count }] = await dataSource.query<{ count: number }[]>(
      `SELECT (SELECT count(*) FROM tool_modes)::int
            + (SELECT count(*) FROM tool_variants)::int
            + (SELECT count(*) FROM tool_ues)::int AS count`,
    );
    expect(count).toBe(0);
  });

  it('répond 404 pour un outil inconnu', async () => {
    expect((await client('get', '/api/tools/abc')).status).toBe(404);
    expect((await client('patch', '/api/tools/9999').send({})).status).toBe(
      404,
    );
  });
});
