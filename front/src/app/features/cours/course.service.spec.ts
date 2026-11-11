import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CourseService } from './course.service';

describe('CourseService', () => {
  let service: CourseService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('liste les cours d’une UE', () => {
    service.list('UTC502').subscribe();

    expect(http.expectOne('/api/ues/UTC502/courses').request.method).toBe('GET');
  });

  it('enregistre l’ordre des cours d’une UE', () => {
    service.reorder('UTC502', [9, 7]).subscribe();

    const request = http.expectOne('/api/ues/UTC502/courses/order').request;
    expect(request.method).toBe('PUT');
    expect(request.body).toEqual({ ids: [9, 7] });
  });

  it('crée un cours dans une UE', () => {
    service.create('UTC502', { title: 'Processus' }).subscribe();

    const request = http.expectOne('/api/ues/UTC502/courses').request;
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ title: 'Processus' });
  });

  it('lit, modifie et supprime un cours par son numéro', () => {
    service.get(7).subscribe();
    service.update(7, { title: 'Nouveau titre' }).subscribe();
    service.remove(7).subscribe();

    const methods = http.match('/api/courses/7').map((match) => match.request.method);
    expect(methods).toEqual(['GET', 'PATCH', 'DELETE']);
  });

  it('envoie une image en multipart', () => {
    const file = new File(['x'], 'capture.png', { type: 'image/png' });

    service.uploadImage(7, file).subscribe();

    const request = http.expectOne('/api/courses/7/images').request;
    expect(request.method).toBe('POST');
    expect((request.body as FormData).get('file')).toBe(file);
  });
});
