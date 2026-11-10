import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('retrouve la session ouverte au chargement', async () => {
    const restored = firstValueFrom(service.restore());
    http.expectOne('/api/auth/me').flush({ username: 'pierre' });

    expect(await restored).toBe(true);
    expect(service.user()).toEqual({ username: 'pierre' });
    expect(service.isAuthenticated()).toBe(true);
  });

  it('reste déconnecté quand l’API refuse la session', async () => {
    const restored = firstValueFrom(service.restore());
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await restored).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('n’interroge l’API qu’une fois', async () => {
    const first = firstValueFrom(service.restore());
    http.expectOne('/api/auth/me').flush({ username: 'pierre' });
    await first;

    expect(await firstValueFrom(service.restore())).toBe(true);
    http.expectNone('/api/auth/me');
  });

  it('ouvre la session à la connexion', async () => {
    const login = firstValueFrom(service.login({ username: 'pierre', password: 'secret' }));
    const request = http.expectOne('/api/auth/login');
    request.flush({ username: 'pierre' });
    await login;

    expect(request.request.body).toEqual({ username: 'pierre', password: 'secret' });
    expect(service.isAuthenticated()).toBe(true);
  });

  it('n’envoie qu’une requête quand deux gardes restaurent la session en même temps', async () => {
    const first = firstValueFrom(service.restore());
    const second = firstValueFrom(service.restore());
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await first).toBe(false);
    expect(await second).toBe(false);
  });

  it('tient compte d’une connexion faite après une restauration sans session', async () => {
    const restored = firstValueFrom(service.restore());
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await restored;
    const login = firstValueFrom(service.login({ username: 'pierre', password: 'secret' }));
    http.expectOne('/api/auth/login').flush({ username: 'pierre' });
    await login;

    expect(await firstValueFrom(service.restore())).toBe(true);
  });

  it('ferme la session à la déconnexion', async () => {
    const login = firstValueFrom(service.login({ username: 'pierre', password: 'secret' }));
    http.expectOne('/api/auth/login').flush({ username: 'pierre' });
    await login;

    const logout = firstValueFrom(service.logout(), { defaultValue: undefined });
    http.expectOne('/api/auth/logout').flush(null);
    await logout;

    expect(service.isAuthenticated()).toBe(false);
  });
});
