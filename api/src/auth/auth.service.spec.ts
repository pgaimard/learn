import { UnauthorizedException } from '@nestjs/common';
import { hashPassword } from '../users/password-hasher.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

async function createService(): Promise<AuthService> {
  const user: User = {
    id: 1,
    username: 'pierre',
    passwordHash: await hashPassword('mot de passe long'),
    createdAt: new Date(),
  };
  const usersService = {
    findByUsername: (username: string) =>
      Promise.resolve(username === user.username ? user : null),
    findById: (id: number) => Promise.resolve(id === user.id ? user : null),
  } as unknown as UsersService;
  return new AuthService(usersService);
}

describe('AuthService', () => {
  it('accepte le bon identifiant et le bon mot de passe', async () => {
    const service = await createService();

    const user = await service.validateCredentials(
      'pierre',
      'mot de passe long',
    );

    expect(user.id).toBe(1);
  });

  it('refuse un mauvais mot de passe', async () => {
    const service = await createService();

    await expect(
      service.validateCredentials('pierre', 'mauvais'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un identifiant inconnu avec le même message', async () => {
    const service = await createService();

    const wrongPassword = service.validateCredentials('pierre', 'mauvais');
    const unknownUser = service.validateCredentials('inconnu', 'mauvais');

    await expect(wrongPassword).rejects.toThrow(
      'Identifiant ou mot de passe incorrect.',
    );
    await expect(unknownUser).rejects.toThrow(
      'Identifiant ou mot de passe incorrect.',
    );
  });

  it('refuse une session dont le compte n’existe plus', async () => {
    const service = await createService();

    await expect(service.getCurrentUser(2)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
