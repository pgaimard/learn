import { hashPassword, verifyPassword } from './password-hasher.js';

describe('password-hasher', () => {
  it('hache en Argon2id sans conserver le mot de passe', async () => {
    const passwordHash = await hashPassword('correct horse battery');

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain('correct horse battery');
  });

  it('accepte le bon mot de passe et refuse un mauvais', async () => {
    const passwordHash = await hashPassword('correct horse battery');

    await expect(
      verifyPassword(passwordHash, 'correct horse battery'),
    ).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, 'autre')).resolves.toBe(false);
  });

  it('refuse un hash illisible au lieu de lever une erreur', async () => {
    await expect(verifyPassword('pas-un-hash', 'x')).resolves.toBe(false);
  });
});
