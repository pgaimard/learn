import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToolService } from './tool.service';

describe('ToolService', () => {
  let service: ToolService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ToolService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('liste et lit les outils', () => {
    service.list().subscribe();
    service.get(3).subscribe();

    expect(http.expectOne('/api/tools').request.method).toBe('GET');
    expect(http.expectOne('/api/tools/3').request.method).toBe('GET');
  });

  it('crée, modifie et supprime un outil', () => {
    service.create({ name: 'bash' }).subscribe();
    service.update(3, { variants: [{ id: 1, name: 'bash' }, { name: 'zsh' }] }).subscribe();
    service.remove(3).subscribe();

    expect(http.expectOne({ method: 'POST', url: '/api/tools' }).request.body).toEqual({
      name: 'bash',
    });
    expect(http.expectOne({ method: 'PATCH', url: '/api/tools/3' }).request.body).toEqual({
      variants: [{ id: 1, name: 'bash' }, { name: 'zsh' }],
    });
    http.expectOne({ method: 'DELETE', url: '/api/tools/3' });
  });
});
