import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EventService } from './event.service';

describe('EventService', () => {
  let service: EventService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('demande les événements d’une période en dates ISO', () => {
    const from = new Date('2026-11-16T00:00:00Z');
    const to = new Date('2026-11-23T00:00:00Z');

    service.list(from, to).subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/events').request;
    expect(request.params.get('from')).toBe('2026-11-16T00:00:00.000Z');
    expect(request.params.get('to')).toBe('2026-11-23T00:00:00.000Z');
  });

  it('crée les occurrences, modifie et supprime un événement', () => {
    const details = {
      title: 'Cours',
      description: 'Salle 31',
      type: 'course' as const,
      ueCode: 'UTC502',
    };
    const occurrence = { startsAt: '2026-11-17T18:00:00.000Z', endsAt: '2026-11-17T21:00:00.000Z' };

    service.create(details, [occurrence]).subscribe();
    service.update(4, { ...details, ...occurrence }).subscribe();
    service.remove(4).subscribe();

    expect(http.expectOne({ method: 'POST', url: '/api/events' }).request.body).toEqual({
      ...details,
      occurrences: [occurrence],
    });
    expect(http.expectOne({ method: 'PATCH', url: '/api/events/4' }).request.body).toEqual({
      ...details,
      ...occurrence,
    });
    http.expectOne({ method: 'DELETE', url: '/api/events/4' });
  });
});
