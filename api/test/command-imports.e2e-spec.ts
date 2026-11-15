import { NestExpressApplication } from '@nestjs/platform-express';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import { ImportPreview } from '../src/courses/import/course-import.service.js';
import { CommandGroup, CommandView } from '../src/tools/commands.service.js';
import { CommandImportPreview } from '../src/tools/import/command-import.js';
import { Tool } from '../src/tools/tool.entity.js';
import { ToolSummary } from '../src/tools/tools.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { createZip } from './create-zip.js';
import { resetDatabase } from './reset-database.js';

const COMMANDS = readFileSync(
  new URL('../../contracts/commandes.example.json', import.meta.url),
  'utf8',
);
const MARKDOWN =
  '---\nue: UTC502\ntitre: Réseau\nordre: 1\n---\n\n## Bases\n\nTexte.';

describe('Import des outils et des commandes', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;

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

  async function findTool(name: string): Promise<Tool> {
    const tools = (await client('get', '/api/tools')).body as ToolSummary[];
    const id = tools.find((tool) => tool.name === name)?.id;
    return (await client('get', `/api/tools/${id}`)).body as Tool;
  }

  async function commandsOf(tool: Tool): Promise<CommandView[]> {
    return (await client('get', `/api/tools/${tool.id}/commands`))
      .body as CommandView[];
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/command-imports')
      .send({ content: COMMANDS });

    expect(response.status).toBe(401);
  });

  it('donne un aperçu sans rien enregistrer', async () => {
    const response = await client('post', '/api/command-imports/preview').send({
      content: COMMANDS,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      newTools: ['Cisco IOS', 'Shell Unix'],
      existingTools: [],
      newCommands: [
        { tool: 'Cisco IOS', name: 'ping' },
        { tool: 'Cisco IOS', name: 'show ip route' },
        { tool: 'Shell Unix', name: 'ping' },
        { tool: 'Shell Unix', name: 'setopt' },
      ],
      duplicateCommands: [],
    });
    expect((await client('get', '/api/tools')).body).toEqual([]);
  });

  it('crée les outils avec leur fiche, leurs modes, leurs déclinaisons et leurs commandes', async () => {
    const response = await client('post', '/api/command-imports').send({
      content: COMMANDS,
    });

    expect(response.status).toBe(201);
    const ios = await findTool('Cisco IOS');
    expect(ios.summary).toBe('Terminal des routeurs et commutateurs Cisco.');
    expect(ios.content.content?.[0]).toMatchObject({ type: 'heading' });
    expect(ios.modes.map(({ name, position }) => [name, position])).toEqual([
      ['Utilisateur', 1],
      ['Privilégié', 2],
      ['Configuration globale', 3],
    ]);
    const [ping, route] = await commandsOf(ios);
    expect(ping).toMatchObject({
      name: 'ping',
      modeId: ios.modes[1].id,
      themes: ['réseau', 'diagnostic'],
      courses: [],
    });
    expect(ping.options[1]).toMatchObject({
      text: 'source <interface>',
      variantIds: [ios.variants[1].id],
    });
    expect(ping.examples[0].output).toContain('!!!!!');
    expect(ping.alsoIn).toHaveLength(1);
    expect(route.name).toBe('show ip route');
    const shell = await findTool('Shell Unix');
    const setopt = (await commandsOf(shell)).find(
      ({ name }) => name === 'setopt',
    );
    expect(setopt?.variantIds).toEqual([shell.variants[1].id]);
    // Le texte cherché par la recherche globale est dérivé à l'import.
    const search = await client('get', '/api/search').query({
      q: 'passerelle',
    });
    expect(
      (search.body as { commands: { total: number } }).commands.total,
    ).toBe(1);
  });

  it('laisse tels quels un outil et une commande déjà présents, et ajoute ce qui manque', async () => {
    const ios = await findTool('Cisco IOS');
    const [ping] = await commandsOf(ios);
    await client('patch', `/api/tools/${ios.id}/commands/${ping.id}`).send({
      summary: 'Retouché à la main.',
    });
    const file = JSON.stringify([
      {
        outil: 'cisco ios',
        presentation: 'Autre présentation.',
        modes: [{ nom: 'Interface', invite: 'Router(config-if)#' }],
        commandes: [
          { nom: 'PING', description: 'Venu du fichier.' },
          { nom: 'ip address', mode: 'Interface' },
        ],
      },
    ]);

    const preview = await client('post', '/api/command-imports/preview').send({
      content: file,
    });
    const imported = await client('post', '/api/command-imports').send({
      content: file,
    });

    const expected: CommandImportPreview = {
      newTools: [],
      existingTools: ['cisco ios'],
      newCommands: [{ tool: 'Cisco IOS', name: 'ip address' }],
      duplicateCommands: [{ tool: 'Cisco IOS', name: 'PING' }],
    };
    expect(preview.body).toEqual(expected);
    expect(imported.body).toEqual(expected);
    const after = await findTool('Cisco IOS');
    expect(after.summary).toBe('Terminal des routeurs et commutateurs Cisco.');
    expect(after.modes.map(({ name }) => name)).toEqual([
      'Utilisateur',
      'Privilégié',
      'Configuration globale',
      'Interface',
    ]);
    const commands = await commandsOf(after);
    expect(commands.map(({ name }) => name)).toEqual([
      'ip address',
      'ping',
      'show ip route',
    ]);
    expect(commands[1].summary).toBe('Retouché à la main.');
    expect(commands[0].modeId).toBe(after.modes[3].id);
  });

  it('remplace sur demande une commande déjà présente, en gardant ses rattachements', async () => {
    const ios = await findTool('Cisco IOS');
    const ping = (await commandsOf(ios)).find(({ name }) => name === 'ping');
    await client('patch', `/api/tools/${ios.id}/commands/${ping?.id}`).send({
      ueCodes: ['UTC502'],
    });

    const response = await client('post', '/api/command-imports').send({
      content: JSON.stringify([
        {
          outil: 'Cisco IOS',
          commandes: [
            { nom: 'ping', description: 'Venu du fichier.', options: [] },
          ],
        },
      ]),
      replace: true,
    });

    expect(response.status).toBe(201);
    const replaced = (await commandsOf(ios)).find(
      ({ name }) => name === 'ping',
    );
    expect(replaced).toMatchObject({
      id: ping?.id,
      summary: 'Venu du fichier.',
      syntax: '',
      modeId: null,
      options: [],
      examples: [],
      ueCodes: ['UTC502'],
    });
  });

  it('refuse un fichier invalide sans rien écrire', async () => {
    const response = await client('post', '/api/command-imports').send({
      content: JSON.stringify([
        { outil: 'git', commandes: [{ nom: 'log' }, { description: 'x' }] },
      ]),
    });

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages).toEqual([
      'commandes.json, outil 1, commande 2 : « nom » est requis.',
    ]);
    const names = (
      (await client('get', '/api/tools')).body as ToolSummary[]
    ).map((tool) => tool.name);
    expect(names).toEqual(['Cisco IOS', 'Shell Unix']);
  });

  describe('dans un paquet de cours', () => {
    const zip = (commands: string): Buffer =>
      createZip({ 'cours.md': MARKDOWN, 'commandes.json': commands });
    const GIT = JSON.stringify([
      {
        outil: 'git',
        commandes: [{ nom: 'log', description: 'Montre l’historique.' }],
      },
      { outil: 'Shell Unix', commandes: [{ nom: 'setopt' }] },
    ]);

    it('annonce les outils et commandes du paquet dans l’aperçu', async () => {
      const response = await client(
        'post',
        '/api/course-imports/preview',
      ).attach('file', zip(GIT), 'paquet.zip');

      expect(response.status).toBe(200);
      expect((response.body as ImportPreview).commands).toEqual({
        newTools: ['git'],
        existingTools: ['Shell Unix'],
        newCommands: [{ tool: 'git', name: 'log' }],
        duplicateCommands: [{ tool: 'Shell Unix', name: 'setopt' }],
      });
    });

    it('importe les commandes et les rattache au cours, déjà présentes ou non', async () => {
      const response = await client('post', '/api/course-imports').attach(
        'file',
        zip(GIT),
        'paquet.zip',
      );

      expect(response.status).toBe(201);
      const course = response.body as Course;
      const groups = (await client('get', `/api/courses/${course.id}/commands`))
        .body as CommandGroup[];
      expect(
        groups.map((group) => [
          group.tool.name,
          ...group.commands.map(({ name }) => name),
        ]),
      ).toEqual([
        ['git', 'log'],
        ['Shell Unix', 'setopt'],
      ]);
    });

    it('refuse tout le paquet quand commandes.json est invalide', async () => {
      const response = await client('post', '/api/course-imports')
        .field('replace', 'true')
        .attach('file', zip('[{"commandes": []}]'), 'paquet.zip');

      expect(response.status).toBe(400);
      expect((response.body as ErrorResponse).messages.join(' ')).toContain(
        'commandes.json, outil 1 : « outil » est requis.',
      );
    });

    it('n’enregistre aucune commande quand l’import du cours échoue', async () => {
      // Le chapitre existe déjà et son remplacement n'est pas confirmé.
      const response = await client('post', '/api/course-imports').attach(
        'file',
        zip('[{"outil": "npm", "commandes": [{"nom": "install"}]}]'),
        'paquet.zip',
      );

      expect(response.status).toBe(409);
      const names = (
        (await client('get', '/api/tools')).body as ToolSummary[]
      ).map((tool) => tool.name);
      expect(names).not.toContain('npm');
    });
  });
});
