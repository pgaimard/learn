import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Task } from '../src/tasks/task.entity.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

describe('Tâches', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let reportId: number;

  async function create(body: object): Promise<request.Response> {
    return client('post', '/api/tasks').send(body);
  }

  async function titles(query = ''): Promise<string[]> {
    const response = await client('get', `/api/tasks${query}`);
    expect(response.status).toBe(200);
    return (response.body as Task[]).map((task) => task.title);
  }

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    await client('post', '/api/ues').send({
      code: 'NFE108',
      title: 'Méthodes',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get('/api/tasks');

    expect(response.status).toBe(401);
  });

  it('crée une tâche avec UE, échéance et rappel', async () => {
    const response = await create({
      title: '  Rendre le rapport ',
      ueCode: 'utc502',
      dueAt: '2026-12-15T17:00:00.000Z',
      remindAt: '2026-12-10T08:00:00+01:00',
    });

    expect(response.status).toBe(201);
    const task = response.body as Task;
    reportId = task.id;
    expect(task).toMatchObject({
      title: 'Rendre le rapport',
      ue: { code: 'UTC502' },
      dueAt: '2026-12-15T17:00:00.000Z',
      remindAt: '2026-12-10T07:00:00.000Z',
      done: false,
    });
  });

  it('crée une tâche réduite à son titre', async () => {
    const response = await create({ title: 'Acheter un cahier' });

    expect(response.body).toMatchObject({
      ue: null,
      dueAt: null,
      remindAt: null,
      done: false,
    });
  });

  it.each([
    ['un titre vide', { title: '  ' }],
    ['un titre trop long', { title: 'a'.repeat(201) }],
    ['une UE inconnue', { title: 'X', ueCode: 'ABC123' }],
    ['une échéance qui n’est pas une date', { title: 'X', dueAt: 'demain' }],
    ['une date impossible', { title: 'X', dueAt: '2026-02-30T10:00:00Z' }],
    ['un rappel invalide', { title: 'X', remindAt: 12 }],
    ['un état qui n’est pas un booléen', { title: 'X', done: 'oui' }],
    ['une propriété inconnue', { title: 'X', id: 4 }],
  ])('refuse %s', async (_label, body) => {
    expect((await create(body)).status).toBe(400);
  });

  it('liste les tâches à faire d’abord, par échéance, sans échéance en dernier', async () => {
    await create({
      title: 'Réviser',
      dueAt: '2026-12-01T09:00:00Z',
      ueCode: 'NFE108',
    });
    await create({
      title: 'Déjà fait',
      dueAt: '2026-11-01T09:00:00Z',
      done: true,
    });

    expect(await titles()).toEqual([
      'Réviser',
      'Rendre le rapport',
      'Acheter un cahier',
      'Déjà fait',
    ]);
  });

  it('filtre par UE, par état et par période d’échéance', async () => {
    expect(await titles('?ue=UTC502')).toEqual(['Rendre le rapport']);
    expect(await titles('?done=true')).toEqual(['Déjà fait']);
    expect(await titles('?done=false&ue=NFE108')).toEqual(['Réviser']);
    expect(
      await titles('?dueFrom=2026-12-01T00:00:00Z&dueTo=2026-12-08T00:00:00Z'),
    ).toEqual(['Réviser']);
  });

  it('refuse un filtre invalide ou une UE inconnue', async () => {
    expect((await client('get', '/api/tasks?done=oui')).status).toBe(400);
    expect((await client('get', '/api/tasks?dueFrom=hier')).status).toBe(400);
    expect((await client('get', '/api/tasks?tri=date')).status).toBe(400);
    expect((await client('get', '/api/tasks?ue=ABC123')).status).toBe(404);
  });

  it('coche une tâche sans toucher au reste', async () => {
    const response = await client('patch', `/api/tasks/${reportId}`).send({
      done: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      title: 'Rendre le rapport',
      done: true,
      dueAt: '2026-12-15T17:00:00.000Z',
      ue: { code: 'UTC502' },
    });
  });

  it('modifie le titre et efface l’UE, l’échéance et le rappel', async () => {
    const response = await client('patch', `/api/tasks/${reportId}`).send({
      title: 'Rendre le rapport final',
      ueCode: null,
      dueAt: null,
      remindAt: null,
      done: false,
    });

    expect(response.body).toMatchObject({
      title: 'Rendre le rapport final',
      ue: null,
      dueAt: null,
      remindAt: null,
      done: false,
    });
  });

  it('renvoie 404 pour une tâche inconnue', async () => {
    expect(
      (await client('patch', '/api/tasks/9999').send({ done: true })).status,
    ).toBe(404);
    expect((await client('delete', '/api/tasks/abc')).status).toBe(404);
  });

  it('garde la tâche quand son UE est supprimée', async () => {
    await client('delete', '/api/ues/NFE108');

    const response = await client('get', '/api/tasks?done=false');
    const revise = (response.body as Task[]).find(
      (task) => task.title === 'Réviser',
    );
    expect(revise).toMatchObject({ ue: null });
  });

  it('supprime une tâche', async () => {
    expect((await client('delete', `/api/tasks/${reportId}`)).status).toBe(204);
    expect(await titles()).not.toContain('Rendre le rapport final');
  });
});
