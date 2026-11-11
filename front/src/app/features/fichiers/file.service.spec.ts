import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FileService } from './file.service';

describe('FileService', () => {
  let service: FileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gère les dossiers d’une UE', () => {
    service.listFolders('UTC502').subscribe();
    service.createFolder('UTC502', 'TD', 4).subscribe();
    service.renameFolder(4, 'Travaux dirigés').subscribe();
    service.removeFolder(4).subscribe();

    http.expectOne({ method: 'GET', url: '/api/ues/UTC502/folders' });
    expect(http.expectOne({ method: 'POST', url: '/api/ues/UTC502/folders' }).request.body).toEqual(
      { name: 'TD', parentId: 4 },
    );
    expect(http.expectOne({ method: 'PATCH', url: '/api/folders/4' }).request.body).toEqual({
      name: 'Travaux dirigés',
    });
    http.expectOne({ method: 'DELETE', url: '/api/folders/4' });
  });

  it('liste les fichiers de la racine ou d’un dossier', () => {
    service.listFiles('UTC502', null).subscribe();
    service.listFiles('UTC502', 4).subscribe();

    http.expectOne('/api/ues/UTC502/files');
    http.expectOne('/api/ues/UTC502/files?folder=4');
  });

  it('envoie un fichier dans un dossier en formulaire multipart', () => {
    const file = new File(['x'], 'notes.txt');

    service.upload('UTC502', 4, file).subscribe();

    const body = http.expectOne({ method: 'POST', url: '/api/ues/UTC502/files' }).request
      .body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('folderId')).toBe('4');
  });

  it('n’indique pas de dossier pour un envoi à la racine', () => {
    service.upload('UTC502', null, new File(['x'], 'notes.txt')).subscribe();

    const body = http.expectOne('/api/ues/UTC502/files').request.body as FormData;
    expect(body.has('folderId')).toBe(false);
  });

  it('renomme, déplace et supprime un fichier', () => {
    service.updateFile(7, { name: 'notes.txt' }).subscribe();
    service.updateFile(8, { folderId: null }).subscribe();
    service.removeFile(7).subscribe();

    expect(http.expectOne({ method: 'PATCH', url: '/api/files/7' }).request.body).toEqual({
      name: 'notes.txt',
    });
    expect(http.expectOne({ method: 'PATCH', url: '/api/files/8' }).request.body).toEqual({
      folderId: null,
    });
    http.expectOne({ method: 'DELETE', url: '/api/files/7' });
  });

  it('donne l’adresse de téléchargement d’un fichier', () => {
    expect(service.downloadUrl(7)).toBe('/api/files/7/download');
  });
});
