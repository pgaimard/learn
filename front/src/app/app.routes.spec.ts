import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { SessionService } from './core/auth/session.service';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { LoginPage } from './features/auth/login-page';
import { UeListPage } from './features/ue/ue-list-page';

function setup(isAuthenticated: boolean): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: SessionService, useValue: { restore: () => of(isAuthenticated) } },
    ],
  });
}

describe('routes', () => {
  it('charge en différé la liste des UE sur la page d’accueil', async () => {
    setup(true);
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/', UeListPage);

    expect(page).toBeInstanceOf(UeListPage);
  });

  it('redirige une adresse inconnue vers la page d’accueil', async () => {
    setup(true);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/adresse-inconnue');

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('affiche la connexion à la place de l’accueil sans session', async () => {
    setup(false);
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/', LoginPage);

    expect(page).toBeInstanceOf(LoginPage);
    expect(TestBed.inject(Router).url).toBe('/connexion');
  });

  it('n’interroge l’API qu’une fois au chargement sans session', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const navigation = router.navigateByUrl('/');
    const request = await vi.waitFor(() => backend.expectOne('/api/auth/me'));
    request.flush(
      { messages: ['Authentification requise.'] },
      { status: 401, statusText: 'Erreur' },
    );
    await navigation;
    await vi.waitFor(() => expect(router.url).toBe('/connexion'));

    backend.verify();
  });
});
