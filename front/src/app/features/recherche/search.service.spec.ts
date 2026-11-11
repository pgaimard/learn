import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';

describe('SearchService', () => {
  it('transmet la saisie en paramètre encodé', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);

    TestBed.inject(SearchService).search('mémoire & co').subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/search').request;
    expect(request.method).toBe('GET');
    expect(request.params.get('q')).toBe('mémoire & co');
    http.verify();
  });
});
