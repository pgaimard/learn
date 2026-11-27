import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('confirme le mot de passe auprès de l’API', () => {
    service.authorize('secret').subscribe();

    const request = http.expectOne({ method: 'POST', url: '/api/exports/authorization' });
    expect(request.request.body).toEqual({ password: 'secret' });
  });

  it('fait télécharger l’archive par le navigateur, sans mot de passe dans l’adresse', () => {
    let followed = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      followed = this.getAttribute('href') ?? '';
    });

    service.download();

    expect(followed).toBe('/api/exports');
  });
});
