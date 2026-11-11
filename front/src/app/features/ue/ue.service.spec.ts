import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UeService } from './ue.service';

describe('UeService', () => {
  let service: UeService;
  let http: HttpTestingController;
  const input = { code: 'UTC502', title: 'Systèmes', description: '' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('liste les UE', () => {
    service.list().subscribe();

    expect(http.expectOne('/api/ues').request.method).toBe('GET');
  });

  it('crée une UE', () => {
    service.create(input).subscribe();

    const request = http.expectOne('/api/ues').request;
    expect(request.method).toBe('POST');
    expect(request.body).toEqual(input);
  });

  it('modifie une UE désignée par son code', () => {
    service.update('UTC502', input).subscribe();

    expect(http.expectOne('/api/ues/UTC502').request.method).toBe('PATCH');
  });

  it('supprime une UE désignée par son code', () => {
    service.remove('UTC502').subscribe();

    expect(http.expectOne('/api/ues/UTC502').request.method).toBe('DELETE');
  });
});
