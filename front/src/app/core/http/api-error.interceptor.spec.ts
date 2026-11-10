import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { ApiError } from './api-error';
import { apiErrorInterceptor } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  function failWith(status: number, body: object): Promise<unknown> {
    const failure = firstValueFrom(http.get('/api/ues')).catch((error: unknown) => error);
    backend.expectOne('/api/ues').flush(body, { status, statusText: 'Erreur' });
    return failure;
  }

  it('transforme une erreur HTTP en ApiError', async () => {
    const error = await failWith(400, { messages: ['Le titre est requis.'] });

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).messages).toEqual(['Le titre est requis.']);
  });

  it('ferme la session et renvoie à la connexion quand la session a expiré', async () => {
    const session = TestBed.inject(SessionService);
    const clear = vi.spyOn(session, 'clear');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await failWith(401, { messages: ['Authentification requise.'] });

    expect(clear).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/connexion');
  });

  it('ne redirige pas pour une autre erreur', async () => {
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await failWith(500, { messages: ['Une erreur interne est survenue.'] });

    expect(navigate).not.toHaveBeenCalled();
  });
});
