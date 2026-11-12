import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { FolderSummary } from '../src/files/folders/folders.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

describe('Dossiers', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let tdId: number;
  let otherUeFolderId: number;

  async function create(
    name: string,
    parentId?: number,
    ue = 'UTC502',
  ): Promise<request.Response> {
    return client('post', `/api/ues/${ue}/folders`).send({ name, parentId });
  }

  async function list(ue = 'UTC502'): Promise<FolderSummary[]> {
    const response = await client('get', `/api/ues/${ue}/folders`);
    expect(response.status).toBe(200);
    return response.body as FolderSummary[];
  }

  function messages(response: request.Response): string[] {
    return (response.body as ErrorResponse).messages;
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
    otherUeFolderId = (
      (await create('Annales', undefined, 'NFE108')).body as FolderSummary
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/ues/UTC502/folders',
    );

    expect(response.status).toBe(401);
  });

  it('crée un dossier à la racine puis un sous-dossier', async () => {
    const td = await create('  TD ');
    expect(td.status).toBe(201);
    expect(td.body).toEqual({
      id: expect.any(Number) as number,
      parentId: null,
      name: 'TD',
    });
    tdId = (td.body as FolderSummary).id;

    const sub = await create('Corrigés', tdId);
    expect(sub.status).toBe(201);
    expect(sub.body).toMatchObject({ parentId: tdId, name: 'Corrigés' });
  });

  it('liste à plat les dossiers de l’UE, par nom', async () => {
    await create('Annales');

    expect((await list()).map((folder) => folder.name)).toEqual([
      'Annales',
      'Corrigés',
      'TD',
    ]);
    expect((await list('NFE108')).map((folder) => folder.name)).toEqual([
      'Annales',
    ]);
  });

  it('refuse deux dossiers frères de même nom, sans tenir compte de la casse', async () => {
    const atRoot = await create('td');
    const inFolder = await create('CORRIGÉS', tdId);

    expect(atRoot.status).toBe(409);
    expect(messages(atRoot)).toEqual([
      'Un dossier « td » existe déjà à cet endroit.',
    ]);
    expect(inFolder.status).toBe(409);
  });

  it('accepte le même nom à un autre endroit', async () => {
    expect((await create('Annales', tdId)).status).toBe(201);
  });

  it.each([
    ['vide', '   '],
    ['avec une barre oblique', 'a/b'],
    ['« .. »', '..'],
    ['trop long', 'a'.repeat(256)],
  ])('refuse un nom %s', async (_label, name) => {
    expect((await create(name)).status).toBe(400);
  });

  it('refuse un parent inconnu ou d’une autre UE, et une UE inconnue', async () => {
    expect((await create('X', 9999)).status).toBe(400);
    const foreign = await create('X', otherUeFolderId);
    expect(foreign.status).toBe(400);
    expect(messages(foreign)).toEqual([
      'Ce dossier n’existe pas dans cette UE.',
    ]);
    expect((await create('X', undefined, 'ABC123')).status).toBe(404);
  });

  it('renomme un dossier', async () => {
    const response = await client('patch', `/api/folders/${tdId}`).send({
      name: 'Travaux dirigés',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: tdId,
      parentId: null,
      name: 'Travaux dirigés',
    });
  });

  it('refuse de renommer en doublon, ou un dossier inconnu', async () => {
    const duplicate = await client('patch', `/api/folders/${tdId}`).send({
      name: 'annales',
    });
    const unknown = await client('patch', '/api/folders/9999').send({
      name: 'X',
    });
    const unknownProperty = await client('patch', `/api/folders/${tdId}`).send({
      name: 'X',
      ueId: 2,
    });

    expect(duplicate.status).toBe(409);
    expect(unknown.status).toBe(404);
    expect(unknownProperty.status).toBe(400);
  });

  it('déplace un dossier dans un autre, puis le ramène à la racine', async () => {
    const tempId = ((await create('Temp')).body as FolderSummary).id;

    const moved = await client('patch', `/api/folders/${tempId}`).send({
      parentId: tdId,
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual({ id: tempId, parentId: tdId, name: 'Temp' });

    const back = await client('patch', `/api/folders/${tempId}`).send({
      parentId: null,
    });
    expect(back.body).toEqual({ id: tempId, parentId: null, name: 'Temp' });

    expect((await client('delete', `/api/folders/${tempId}`)).status).toBe(204);
  });

  it('refuse de déplacer un dossier dans lui-même ou dans un de ses sous-dossiers', async () => {
    const corriges = (await list()).find(
      (folder) => folder.name === 'Corrigés',
    );

    const intoItself = await client('patch', `/api/folders/${tdId}`).send({
      parentId: tdId,
    });
    const intoChild = await client('patch', `/api/folders/${tdId}`).send({
      parentId: corriges?.id,
    });

    expect(intoItself.status).toBe(400);
    expect(intoChild.status).toBe(400);
    expect(messages(intoChild)).toEqual([
      'Un dossier ne peut pas être déplacé dans lui-même ni dans un de ses sous-dossiers.',
    ]);
    expect(
      (await list()).find((folder) => folder.id === tdId)?.parentId,
    ).toBeNull();
  });

  it('refuse un déplacement vers une autre UE, un dossier inconnu, ou un nom déjà pris', async () => {
    const nested = (await list()).find(
      (folder) => folder.name === 'Annales' && folder.parentId === tdId,
    );

    const foreign = await client('patch', `/api/folders/${tdId}`).send({
      parentId: otherUeFolderId,
    });
    const unknown = await client('patch', `/api/folders/${tdId}`).send({
      parentId: 9999,
    });
    // Un dossier « Annales » existe déjà à la racine.
    const taken = await client('patch', `/api/folders/${nested?.id}`).send({
      parentId: null,
    });

    expect(foreign.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(taken.status).toBe(409);
  });

  it('refuse de supprimer un dossier qui a des sous-dossiers', async () => {
    const response = await client('delete', `/api/folders/${tdId}`);

    expect(response.status).toBe(409);
    expect(messages(response)).toEqual([
      'Le dossier « Travaux dirigés » n’est pas vide : il contient 2 sous-dossier(s) et 0 fichier(s).',
    ]);
  });

  it('supprime un dossier vide', async () => {
    const [annales] = await list();

    expect((await client('delete', `/api/folders/${annales.id}`)).status).toBe(
      204,
    );
    expect((await client('delete', `/api/folders/${annales.id}`)).status).toBe(
      404,
    );
  });

  it('refuse de supprimer une UE qui contient des dossiers', async () => {
    const response = await client('delete', '/api/ues/NFE108');

    expect(response.status).toBe(409);
    expect(messages(response)[0]).toContain('n’est pas vide');
  });
});
