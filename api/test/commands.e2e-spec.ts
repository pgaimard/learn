import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { CommandGroup, CommandView } from '../src/tools/commands.service.js';
import { Tool } from '../src/tools/tool.entity.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

describe('Commandes d’un outil', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let shell: Tool;
  let ios: Tool;
  let pingId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    shell = (
      await client('post', '/api/tools').send({
        name: 'Shell Unix',
        variants: [{ name: 'bash' }, { name: 'zsh' }],
      })
    ).body as Tool;
    ios = (
      await client('post', '/api/tools').send({
        name: 'Cisco IOS',
        modes: [{ name: 'Privilégié', prompt: 'Router#', entry: 'enable' }],
      })
    ).body as Tool;
  });

  afterAll(async () => {
    await app.close();
  });

  function messages(response: { body: unknown }): string {
    return (response.body as ErrorResponse).messages.join(' ');
  }

  function commandsOf(tool: Tool): string {
    return `/api/tools/${tool.id}/commands`;
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get(commandsOf(shell));

    expect(response.status).toBe(401);
  });

  it('crée une commande avec ses options, ses exemples et ses thèmes', async () => {
    const [bash, zsh] = shell.variants;
    const response = await client('post', commandsOf(shell)).send({
      name: ' ping ',
      summary: 'Teste si une machine répond.',
      syntax: 'ping [-c <nombre>] <hôte>',
      variantIds: [zsh.id],
      notes: 'Ctrl+C pour arrêter.',
      themes: ['Réseau', ' diagnostic ', 'réseau'],
      options: [
        { text: '-c <nombre>', description: 'Nombre de paquets.' },
        { text: '-4', variantIds: [bash.id] },
      ],
      examples: [
        {
          line: 'ping -c 2 example.org',
          explanation: 'Deux paquets.',
          output: '  2 packets transmitted\n',
        },
      ],
    });

    expect(response.status).toBe(201);
    const command = response.body as CommandView;
    pingId = command.id;
    expect(command).toMatchObject({
      name: 'ping',
      summary: 'Teste si une machine répond.',
      syntax: 'ping [-c <nombre>] <hôte>',
      modeId: null,
      variantIds: [zsh.id],
      notes: 'Ctrl+C pour arrêter.',
      themes: ['Réseau', 'diagnostic'],
      ueCodes: [],
      courses: [],
      alsoIn: [],
    });
    expect(command.options).toMatchObject([
      {
        text: '-c <nombre>',
        description: 'Nombre de paquets.',
        variantIds: [],
      },
      { text: '-4', description: '', variantIds: [bash.id] },
    ]);
    expect(command.examples).toMatchObject([
      {
        line: 'ping -c 2 example.org',
        explanation: 'Deux paquets.',
        output: '  2 packets transmitted',
      },
    ]);
  });

  it('accepte le même nom dans un autre outil et relie les deux commandes', async () => {
    const created = await client('post', commandsOf(ios)).send({
      name: 'PING',
      modeId: ios.modes[0].id,
    });

    expect(created.status).toBe(201);
    const twin = created.body as CommandView;
    expect(twin.modeId).toBe(ios.modes[0].id);
    expect(twin.alsoIn).toEqual([
      { commandId: pingId, toolId: shell.id, toolName: 'Shell Unix' },
    ]);
    const list = await client('get', commandsOf(shell));
    expect((list.body as CommandView[])[0].alsoIn).toEqual([
      { commandId: twin.id, toolId: ios.id, toolName: 'Cisco IOS' },
    ]);
  });

  it('étiquette une commande avec des UE et des cours, et la montre depuis eux', async () => {
    for (const code of ['UTC505', 'UTC502']) {
      await client('post', '/api/ues').send({ code, title: code });
    }
    const course = (
      await client('post', '/api/ues/UTC502/courses').send({ title: 'Réseau' })
    ).body as { id: number };

    const updated = await client(
      'patch',
      `${commandsOf(shell)}/${pingId}`,
    ).send({ ueCodes: ['utc505'], courseIds: [course.id] });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      ueCodes: ['UTC505'],
      courses: [{ id: course.id, title: 'Réseau', ueCode: 'UTC502' }],
    });
    const names = async (path: string): Promise<string[][]> =>
      ((await client('get', path)).body as CommandGroup[]).map((group) => [
        group.tool.name,
        ...group.commands.map((command) => command.name),
      ]);
    // UTC505 par l'étiquette d'UE, UTC502 par celle du cours.
    expect(await names('/api/ues/UTC505/commands')).toEqual([
      ['Shell Unix', 'ping'],
    ]);
    expect(await names('/api/ues/utc502/commands')).toEqual([
      ['Shell Unix', 'ping'],
    ]);
    expect(await names(`/api/courses/${course.id}/commands`)).toEqual([
      ['Shell Unix', 'ping'],
    ]);
    const groups = (await client('get', '/api/ues/UTC505/commands'))
      .body as CommandGroup[];
    expect(groups[0].tool.variants.map(({ name }) => name)).toEqual([
      'bash',
      'zsh',
    ]);
    expect(groups[0].commands[0].alsoIn).toHaveLength(1);
  });

  it('refuse une UE ou un cours inconnus, et répond 404 depuis eux', async () => {
    const ue = await client('patch', `${commandsOf(shell)}/${pingId}`).send({
      ueCodes: ['XXX000'],
    });
    const course = await client('patch', `${commandsOf(shell)}/${pingId}`).send(
      { courseIds: [9999] },
    );

    expect(ue.status).toBe(400);
    expect(messages(ue)).toContain('L’UE XXX000 n’existe pas.');
    expect(course.status).toBe(400);
    expect(messages(course)).toContain('Le cours n° 9999 n’existe pas.');
    expect((await client('get', '/api/ues/XXX000/commands')).status).toBe(404);
    expect((await client('get', '/api/courses/9999/commands')).status).toBe(
      404,
    );
    expect((await client('get', '/api/courses/abc/commands')).status).toBe(404);
  });

  it('garde la commande quand son cours est supprimé', async () => {
    const [course] = (await client('get', '/api/ues/UTC502/courses')).body as {
      id: number;
    }[];
    await client('delete', `/api/courses/${course.id}`);

    const list = (await client('get', commandsOf(shell))).body as CommandView[];

    expect(list.find(({ name }) => name === 'ping')?.courses).toEqual([]);
    expect(await client('get', '/api/ues/UTC502/commands')).toMatchObject({
      body: [],
    });
  });

  it('refuse le même nom dans le même outil, sans tenir compte de la casse', async () => {
    const response = await client('post', commandsOf(shell)).send({
      name: 'Ping',
    });

    expect(response.status).toBe(409);
    expect(messages(response)).toContain('existe déjà dans cet outil');
  });

  it('liste les commandes d’un outil par ordre alphabétique', async () => {
    await client('post', commandsOf(shell)).send({ name: 'ls' });

    const response = await client('get', commandsOf(shell));

    expect(response.status).toBe(200);
    const names = (response.body as CommandView[]).map(({ name }) => name);
    expect(names).toEqual(['ls', 'ping']);
  });

  it('remplace les options et garde les champs non fournis', async () => {
    const response = await client(
      'patch',
      `${commandsOf(shell)}/${pingId}`,
    ).send({ options: [{ text: '-i <secondes>' }], variantIds: [] });

    expect(response.status).toBe(200);
    const command = response.body as CommandView;
    expect(command.options.map(({ text }) => text)).toEqual(['-i <secondes>']);
    expect(command.variantIds).toEqual([]);
    expect(command.summary).toBe('Teste si une machine répond.');
    expect(command.examples).toHaveLength(1);
  });

  it('refuse un mode ou une déclinaison d’un autre outil', async () => {
    const mode = await client('patch', `${commandsOf(shell)}/${pingId}`).send({
      modeId: ios.modes[0].id,
    });
    const variant = await client('post', commandsOf(ios)).send({
      name: 'show',
      options: [{ text: 'brief', variantIds: [shell.variants[0].id] }],
    });

    expect(mode.status).toBe(400);
    expect(messages(mode)).toContain('n’appartient pas à cet outil');
    expect(variant.status).toBe(400);
    expect(messages(variant)).toContain('n’appartient pas à cet outil');
  });

  it('refuse une entrée invalide', async () => {
    const response = await client('post', commandsOf(shell)).send({
      name: '',
      themes: ['x'.repeat(41)],
      options: [{ description: 'sans texte' }],
      examples: [{ line: ' ' }],
      color: 'rouge',
    });

    expect(response.status).toBe(400);
    const text = messages(response);
    expect(text).toContain('Le nom est requis.');
    expect(text).toContain('Un thème ne doit pas dépasser 40 caractères.');
    expect(text).toContain('Le texte d’une option est requis.');
    expect(text).toContain('La ligne de commande d’un exemple est requise.');
    expect(text).toContain('color');
  });

  it('garde la commande quand son mode est retiré de l’outil', async () => {
    await client('patch', `/api/tools/${ios.id}`).send({ modes: [] });

    const response = await client('get', commandsOf(ios));

    expect(response.body as CommandView[]).toMatchObject([
      { name: 'PING', modeId: null },
    ]);
  });

  it('répond 404 pour un outil ou une commande inconnus', async () => {
    const tool = await client('get', '/api/tools/9999/commands');
    const elsewhere = await client(
      'patch',
      `${commandsOf(ios)}/${pingId}`,
    ).send({ summary: 'x' });
    const text = await client('delete', `${commandsOf(shell)}/abc`);

    expect(tool.status).toBe(404);
    expect(elsewhere.status).toBe(404);
    expect(text.status).toBe(404);
  });

  it('supprime une commande, et toutes celles d’un outil supprimé', async () => {
    const removed = await client('delete', `${commandsOf(shell)}/${pingId}`);
    await client('delete', `/api/tools/${shell.id}`);

    expect(removed.status).toBe(204);
    const rows: unknown = await app
      .get(DataSource)
      .query(
        'SELECT (SELECT count(*)::int FROM commands) AS commands, (SELECT count(*)::int FROM command_options) AS options, (SELECT count(*)::int FROM command_examples) AS examples',
      );
    expect(rows).toEqual([{ commands: 1, options: 0, examples: 0 }]);
  });
});
