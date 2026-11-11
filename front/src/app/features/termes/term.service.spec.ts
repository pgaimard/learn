import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TermService } from './term.service';

describe('TermService', () => {
  let service: TermService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TermService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('liste les termes d’un type et d’une UE', () => {
    service.list({ type: 'acronym', ue: 'UTC502' }).subscribe();

    const request = http.expectOne('/api/terms?type=acronym&ue=UTC502').request;
    expect(request.method).toBe('GET');
  });

  it('liste tous les termes sans filtre', () => {
    service.list().subscribe();

    http.expectOne('/api/terms');
  });

  it('crée, modifie et supprime un terme', () => {
    service.create({ type: 'definition', label: 'Processus' }).subscribe();
    service.update(4, { label: 'Processus léger' }).subscribe();
    service.remove(4).subscribe();

    expect(http.expectOne({ method: 'POST', url: '/api/terms' }).request.body).toEqual({
      type: 'definition',
      label: 'Processus',
    });
    expect(http.expectOne({ method: 'PATCH', url: '/api/terms/4' }).request.body).toEqual({
      label: 'Processus léger',
    });
    http.expectOne({ method: 'DELETE', url: '/api/terms/4' });
  });

  it('signale chaque création réussie aux listes affichées', () => {
    service.create({ type: 'definition', label: 'Processus' }).subscribe();
    expect(service.revision()).toBe(0);

    http.expectOne('/api/terms').flush({ id: 1 });

    expect(service.revision()).toBe(1);
  });

  it('envoie une image en formulaire multipart', () => {
    const file = new File(['x'], 'schema.png', { type: 'image/png' });

    service.uploadImage(4, file).subscribe();

    const request = http.expectOne('/api/terms/4/images').request;
    expect(request.method).toBe('POST');
    expect((request.body as FormData).get('file')).toBe(file);
  });
});
