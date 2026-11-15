import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CommandImportService } from './command-import.service';

describe('CommandImportService', () => {
  it('envoie le contenu du fichier pour l’aperçu, puis pour l’import', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(CommandImportService);
    const http = TestBed.inject(HttpTestingController);

    service.preview('[]').subscribe();
    service.import('[]', true).subscribe();

    expect(http.expectOne('/api/command-imports/preview').request.body).toEqual({ content: '[]' });
    expect(http.expectOne('/api/command-imports').request.body).toEqual({
      content: '[]',
      replace: true,
    });
    http.verify();
  });
});
