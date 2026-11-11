import { validateEnvironment } from './environment.js';

const validEnvironment = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'learn',
  DATABASE_USER: 'learn',
  DATABASE_PASSWORD: 'secret',
  SESSION_SECRET: 'x'.repeat(32),
  UPLOADS_DIR: '/data/uploads',
};

describe('validateEnvironment', () => {
  it('accepte une configuration valide et convertit les ports en nombres', () => {
    const environment = validateEnvironment(validEnvironment);

    expect(environment.NODE_ENV).toBe('production');
    expect(environment.PORT).toBe(3000);
    expect(environment.DATABASE_PORT).toBe(5432);
  });

  it.each(['PORT', 'DATABASE_HOST', 'DATABASE_PASSWORD'])(
    'refuse une configuration sans %s',
    (missing) => {
      const environment = { ...validEnvironment, [missing]: undefined };

      expect(() => validateEnvironment(environment)).toThrow(
        new RegExp(`Configuration invalide[\\s\\S]*${missing}`),
      );
    },
  );

  it('refuse un environnement inconnu', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'staging' }),
    ).toThrow(/Configuration invalide[\s\S]*NODE_ENV/);
  });

  it('refuse un port hors plage', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, PORT: '70000' }),
    ).toThrow(/Configuration invalide[\s\S]*PORT/);
  });

  it('refuse un secret de session trop court', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, SESSION_SECRET: 'court' }),
    ).toThrow(/Configuration invalide[\s\S]*SESSION_SECRET/);
  });

  it('n’affiche jamais la valeur d’une variable invalide', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, DATABASE_PORT: 'secret' }),
    ).toThrow(expect.not.stringContaining('secret'));
  });
});
