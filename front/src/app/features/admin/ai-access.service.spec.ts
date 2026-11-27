import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AiAccess, AiAccessService } from './ai-access.service';

describe('AiAccessService', () => {
  let service: AiAccessService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiAccessService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lit l’état du jeton, null quand il n’y en a pas', () => {
    const read: (AiAccess | null)[] = [];
    service.status().subscribe((access) => read.push(access));

    http.expectOne({ method: 'GET', url: '/api/ai-access' }).flush({ access: null });

    expect(read).toEqual([null]);
  });

  it('crée un jeton en confirmant le mot de passe, et le révoque', () => {
    service.generate('secret').subscribe();
    service.revoke().subscribe();

    const created = http.expectOne({ method: 'POST', url: '/api/ai-access' });
    expect(created.request.body).toEqual({ password: 'secret' });
    http.expectOne({ method: 'DELETE', url: '/api/ai-access' });
  });
});
