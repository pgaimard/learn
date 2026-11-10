import { NestExpressApplication } from '@nestjs/platform-express';
import request, { Response, Test } from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { UsersService } from '../src/users/users.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const USERNAME = 'pierre';
const PASSWORD = 'mot de passe long';

describe('Authentification', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    await app.get(UsersService).createInitialUser(USERNAME, PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  // Le reverse proxy termine HTTPS : les tests se présentent comme lui.
  function viaProxy(test: Test): Test {
    return test.set('X-Forwarded-Proto', 'https');
  }

  function login(body: object): Test {
    return viaProxy(request(app.getHttpServer()).post('/api/auth/login')).send(
      body,
    );
  }

  function readSessionCookie(response: Response): string {
    const cookies = response.get('Set-Cookie') ?? [];
    return cookies.find((cookie) => cookie.startsWith('__Host-session=')) ?? '';
  }

  async function openSession(): Promise<string> {
    const response = await login({ username: USERNAME, password: PASSWORD });
    return readSessionCookie(response).split(';')[0];
  }

  function getMe(cookie?: string): Test {
    const test = viaProxy(request(app.getHttpServer()).get('/api/auth/me'));
    return cookie ? test.set('Cookie', cookie) : test;
  }

  it('ouvre une session avec un cookie HttpOnly, Secure et SameSite strict', async () => {
    const response = await login({ username: USERNAME, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ username: USERNAME });
    const cookie = readSessionCookie(response);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
  });

  it('donne accès au compte courant avec la session', async () => {
    const response = await getMe(await openSession());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ username: USERNAME });
  });

  it('refuse l’accès sans session', async () => {
    const response = await getMe();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      statusCode: 401,
      error: 'Authentification requise',
      messages: ['Authentification requise.'],
    });
  });

  it('refuse un cookie de session falsifié', async () => {
    const response = await getMe('__Host-session=s%3Afaux.signature');

    expect(response.status).toBe(401);
  });

  it.each([
    ['un mauvais mot de passe', { username: USERNAME, password: 'mauvais' }],
    ['un identifiant inconnu', { username: 'inconnu', password: PASSWORD }],
  ])('refuse %s sans ouvrir de session', async (_case, body) => {
    const response = await login(body);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      messages: ['Identifiant ou mot de passe incorrect.'],
    });
    expect(readSessionCookie(response)).toBe('');
  });

  it('refuse une entrée incomplète', async () => {
    const response = await login({ username: USERNAME });

    expect(response.status).toBe(400);
    const body = response.body as ErrorResponse;
    expect(body.error).toBe('Requête invalide');
    expect(body.messages).toContain('Le mot de passe est requis.');
  });

  it('refuse une propriété inconnue', async () => {
    const response = await login({
      username: USERNAME,
      password: PASSWORD,
      admin: true,
    });

    expect(response.status).toBe(400);
  });

  it('ferme la session à la déconnexion', async () => {
    const cookie = await openSession();

    const logout = await viaProxy(
      request(app.getHttpServer()).post('/api/auth/logout'),
    ).set('Cookie', cookie);

    expect(logout.status).toBe(204);
    expect((await getMe(cookie)).status).toBe(401);
  });

  it('refuse la déconnexion sans session', async () => {
    const response = await viaProxy(
      request(app.getHttpServer()).post('/api/auth/logout'),
    );

    expect(response.status).toBe(401);
  });

  it('ne pose pas de cookie de session hors HTTPS', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: USERNAME, password: PASSWORD });

    expect(readSessionCookie(response)).toBe('');
  });
});
