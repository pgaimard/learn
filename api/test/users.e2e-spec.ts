import { ConflictException, INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersService } from '../src/users/users.service.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

describe('UsersService', () => {
  let app: INestApplication;
  let users: UsersService;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    users = app.get(UsersService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('crée le compte initial avec un mot de passe haché', async () => {
    const created = await users.createInitialUser(
      'pierre',
      'mot de passe long',
    );

    const stored = await users.findByUsername('pierre');
    expect(stored?.id).toBe(created.id);
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.createdAt).toBeInstanceOf(Date);
  });

  it('retrouve le compte par son numéro', async () => {
    const stored = await users.findByUsername('pierre');

    expect((await users.findById(stored?.id ?? 0))?.username).toBe('pierre');
  });

  it('refuse de créer un second compte', async () => {
    await expect(
      users.createInitialUser('autre', 'mot de passe long'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ne trouve pas un identifiant inconnu', async () => {
    await expect(users.findByUsername('inconnu')).resolves.toBeNull();
  });
});
