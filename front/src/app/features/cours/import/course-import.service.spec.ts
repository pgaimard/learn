import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CourseImportService } from './course-import.service';

describe('CourseImportService', () => {
  let service: CourseImportService;
  let http: HttpTestingController;
  const file = new File(['zip'], 'paquet.zip', { type: 'application/zip' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseImportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('demande l’aperçu d’un paquet en multipart', () => {
    service.preview({ kind: 'package', file }).subscribe();

    const request = http.expectOne('/api/course-imports/preview').request;
    expect((request.body as FormData).get('file')).toBe(file);
  });

  it('importe un paquet en transmettant la confirmation de remplacement', () => {
    service.import({ kind: 'package', file }, true, true).subscribe();

    const body = http.expectOne('/api/course-imports').request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('replace')).toBe('true');
    expect(body.get('replaceTerms')).toBe('true');
  });

  it('envoie le Markdown collé en JSON', () => {
    service.preview({ kind: 'markdown', markdown: '## Titre' }).subscribe();
    service.import({ kind: 'markdown', markdown: '## Titre' }, false).subscribe();

    expect(http.expectOne('/api/course-imports/markdown/preview').request.body).toEqual({
      markdown: '## Titre',
    });
    expect(http.expectOne('/api/course-imports/markdown').request.body).toEqual({
      markdown: '## Titre',
      replace: false,
    });
  });
});
