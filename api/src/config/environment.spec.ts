import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('accepte une configuration valide et convertit le port en nombre', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'production',
      PORT: '3000',
    });

    expect(environment.NODE_ENV).toBe('production');
    expect(environment.PORT).toBe(3000);
  });

  it('refuse une configuration sans port', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      /Configuration invalide[\s\S]*PORT/,
    );
  });

  it('refuse un environnement inconnu', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'staging', PORT: '3000' }),
    ).toThrow(/Configuration invalide[\s\S]*NODE_ENV/);
  });

  it('refuse un port hors plage', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', PORT: '70000' }),
    ).toThrow(/Configuration invalide[\s\S]*PORT/);
  });
});
