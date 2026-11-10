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
});
