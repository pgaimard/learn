import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Ue } from '../src/ue/ue.entity.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

describe('UE', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get('/api/ues');

    expect(response.status).toBe(401);
  });

  it('crée une UE en normalisant le code', async () => {
    const response = await client('post', '/api/ues').send({
      code: ' utc502 ',
      title: 'Principes fondamentaux des systèmes d’exploitation',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      code: 'UTC502',
      title: 'Principes fondamentaux des systèmes d’exploitation',
      description: '',
      position: 1,
    });
  });

  it('place une nouvelle UE à la suite des autres', async () => {
    const response = await client('post', '/api/ues').send({
      code: 'NFE108',
      title: 'Méthodologies des systèmes d’information',
      description: 'Merise et UML',
    });

    expect((response.body as Ue).position).toBe(2);
  });

  it('refuse un code déjà utilisé', async () => {
    const response = await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Doublon',
    });

    expect(response.status).toBe(409);
    expect((response.body as ErrorResponse).messages).toEqual([
      'Une UE porte déjà le code UTC502.',
    ]);
  });

  it('refuse une entrée invalide avec des messages en français', async () => {
    const response = await client('post', '/api/ues').send({
      code: 'x',
      title: '',
      inconnu: true,
    });

    expect(response.status).toBe(400);
    const { messages } = response.body as ErrorResponse;
    expect(messages).toContain('L’intitulé est requis.');
    expect(messages).toContain(
      'Le code doit contenir de 3 à 10 lettres ou chiffres (ex. UTC502).',
    );
  });

  it('liste les UE dans l’ordre', async () => {
    const response = await client('get', '/api/ues');

    expect(response.status).toBe(200);
    expect((response.body as Ue[]).map((ue) => ue.code)).toEqual([
      'UTC502',
      'NFE108',
    ]);
  });

  it('retrouve une UE par son code, sans tenir compte de la casse', async () => {
    const response = await client('get', '/api/ues/nfe108');

    expect(response.status).toBe(200);
    expect((response.body as Ue).description).toBe('Merise et UML');
  });

  it('répond 404 pour un code inconnu', async () => {
    const response = await client('get', '/api/ues/ABC123');

    expect(response.status).toBe(404);
    expect((response.body as ErrorResponse).messages).toEqual([
      'L’UE ABC123 n’existe pas.',
    ]);
  });

  it('modifie une UE sans toucher aux champs absents', async () => {
    const response = await client('patch', '/api/ues/NFE108').send({
      title: 'Méthodologies des SI',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      code: 'NFE108',
      title: 'Méthodologies des SI',
      description: 'Merise et UML',
      position: 2,
    });
  });

  it('ne laisse plus fixer l’ordre à la création ni à la modification', async () => {
    const created = await client('post', '/api/ues').send({
      code: 'ABC123',
      title: 'Essai',
      position: 1,
    });
    const updated = await client('patch', '/api/ues/NFE108').send({
      position: 1,
    });

    expect(created.status).toBe(400);
    expect(updated.status).toBe(400);
  });

  it('réordonne les UE selon la liste reçue', async () => {
    const response = await client('put', '/api/ues/order').send({
      codes: ['nfe108', 'UTC502'],
    });

    expect(response.status).toBe(200);
    expect((response.body as Ue[]).map((ue) => [ue.code, ue.position])).toEqual(
      [
        ['NFE108', 1],
        ['UTC502', 2],
      ],
    );
    const listed = await client('get', '/api/ues');
    expect((listed.body as Ue[]).map((ue) => ue.code)).toEqual([
      'NFE108',
      'UTC502',
    ]);
  });

  it.each([
    ['une liste incomplète', { codes: ['UTC502'] }],
    ['une UE inconnue', { codes: ['UTC502', 'ABC123'] }],
    ['une UE en double', { codes: ['UTC502', 'UTC502'] }],
    ['un doublon à la casse près', { codes: ['UTC502', 'utc502'] }],
    ['autre chose qu’une liste de codes', { codes: 'UTC502' }],
    ['une liste absente', {}],
  ])('refuse de réordonner avec %s', async (_label, body) => {
    const response = await client('put', '/api/ues/order').send(body);

    expect(response.status).toBe(400);
  });

  it('refuse de réordonner sans session', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/ues/order')
      .send({ codes: [] });

    expect(response.status).toBe(401);
  });

  it('refuse de renommer une UE vers un code déjà utilisé', async () => {
    const response = await client('patch', '/api/ues/NFE108').send({
      code: 'UTC502',
    });

    expect(response.status).toBe(409);
  });

  it('supprime une UE', async () => {
    const removal = await client('delete', '/api/ues/NFE108');

    expect(removal.status).toBe(204);
    expect((await client('get', '/api/ues/NFE108')).status).toBe(404);
  });
});
