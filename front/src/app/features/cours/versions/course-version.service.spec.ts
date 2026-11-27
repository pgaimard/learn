import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CourseVersionService } from './course-version.service';

describe('CourseVersionService', () => {
  let service: CourseVersionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseVersionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('liste les versions précédentes d’un cours', () => {
    service.list(7).subscribe();

    http.expectOne({ method: 'GET', url: '/api/courses/7/snapshots' });
  });

  it('restaure une version en indiquant la révision lue du cours', () => {
    service.restore(7, 3, 12).subscribe();

    const request = http.expectOne({ method: 'POST', url: '/api/courses/7/snapshots/3/restore' });
    expect(request.request.body).toEqual({ revision: 12 });
  });
});
