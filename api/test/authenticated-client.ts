import { NestExpressApplication } from '@nestjs/platform-express';
import request, { Test } from 'supertest';
import { UsersService } from '../src/users/users.service.js';

const USERNAME = 'pierre';
const PASSWORD = 'mot de passe long';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type AuthenticatedClient = (method: Method, path: string) => Test;

// Crée le compte, ouvre une session et renvoie de quoi lancer des requêtes authentifiées,
// présentées comme venant du reverse proxy (HTTPS).
export async function createAuthenticatedClient(
  app: NestExpressApplication,
): Promise<AuthenticatedClient> {
  await app.get(UsersService).createInitialUser(USERNAME, PASSWORD);
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .set('X-Forwarded-Proto', 'https')
    .send({ username: USERNAME, password: PASSWORD });
  const cookie = (login.get('Set-Cookie') ?? [])
    .map((value) => value.split(';')[0])
    .join('; ');
  return (method, path) =>
    request(app.getHttpServer())
      [method](path)
      .set('X-Forwarded-Proto', 'https')
      .set('Cookie', cookie);
}
