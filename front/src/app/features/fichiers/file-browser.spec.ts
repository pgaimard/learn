import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { FileBrowser } from './file-browser';
import { FileService, Folder, StoredFile } from './file.service';

const FOLDERS: Folder[] = [
  { id: 1, parentId: null, name: 'TD' },
  { id: 2, parentId: 1, name: 'Corrigés' },
];
const NOTES: StoredFile = {
  id: 7,
  folderId: null,
  name: 'notes.pdf',
  mimeType: 'application/pdf',
  size: 1536,
  updatedAt: '2026-11-10T10:00:00.000Z',
};

describe('FileBrowser', () => {
  let fixture: ComponentFixture<FileBrowser>;
  const service = {
    listFolders: vi.fn<FileService['listFolders']>(),
    listFiles: vi.fn<FileService['listFiles']>(),
    createFolder: vi.fn<FileService['createFolder']>(),
    renameFolder: vi.fn<FileService['renameFolder']>(),
    moveFolder: vi.fn<FileService['moveFolder']>(),
    removeFolder: vi.fn<FileService['removeFolder']>(),
    upload: vi.fn<FileService['upload']>(),
    updateFile: vi.fn<FileService['updateFile']>(),
    removeFile: vi.fn<FileService['removeFile']>(),
    downloadUrl: (id: number) => `/api/files/${id}/download`,
  };
  const dialog = {
    confirm: vi.fn<DialogService['confirm']>(),
    confirmDeletion: vi.fn<DialogService['confirmDeletion']>(),
  };

  // La modale répond de façon asynchrone : on laisse la réponse arriver.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function setup(folderId: number | null = null, files: StoredFile[] = [NOTES]): void {
    service.listFolders.mockReturnValue(of(FOLDERS));
    service.listFiles.mockReturnValue(of(files));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: dialog },
        { provide: FileService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(FileBrowser);
    fixture.componentRef.setInput('ueCode', 'UTC502');
    fixture.componentRef.setInput('folderId', folderId);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return (element().textContent ?? '').replace(/\s+/g, ' ');
  }

  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find(
        (button) =>
          button.textContent.trim() === label || button.getAttribute('aria-label') === label,
      )
      ?.click();
    fixture.detectChanges();
  }

  function submitName(name: string): void {
    const field = element().querySelector<HTMLInputElement>('#entry-name');
    if (field) {
      field.value = name;
      field.dispatchEvent(new Event('input'));
    }
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function pick(...files: File[]): void {
    const field = element().querySelector<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(field, 'files', { value: files, configurable: true });
    field?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function links(selector: string): (string | null)[] {
    return Array.from(element().querySelectorAll(selector)).map((link) =>
      link.getAttribute('href'),
    );
  }

  beforeEach(() => vi.resetAllMocks());

  it('affiche à la racine les dossiers puis les fichiers', () => {
    setup();

    expect(service.listFiles).toHaveBeenCalledWith('UTC502', null);
    expect(links('a.folder')).toEqual(['/?onglet=fichiers&dossier=1']);
    expect(links('a[download]')).toEqual(['/api/files/7/download']);
    expect(text()).toContain('notes.pdf');
    expect(text()).toContain('1,5');
    expect(text()).toContain('10/11/2026');
  });

  it('affiche le chemin et le contenu d’un sous-dossier', () => {
    setup(2, []);

    expect(service.listFiles).toHaveBeenCalledWith('UTC502', 2);
    expect(links('.path a')).toEqual([
      '/?onglet=fichiers',
      '/?onglet=fichiers&dossier=1',
      '/?onglet=fichiers&dossier=2',
    ]);
    expect(text()).toContain('Ce dossier est vide');
  });

  it('signale un dossier inconnu sans proposer d’y envoyer des fichiers', () => {
    setup(99, []);

    expect(text()).toContain('Ce dossier n’existe pas ou plus dans cette UE.');
    expect(element().querySelector('input[type="file"]')).toBeNull();
  });

  it('crée un dossier dans le dossier affiché puis recharge', () => {
    setup(1, []);
    service.createFolder.mockReturnValue(of({ id: 3, parentId: 1, name: 'Sujets' }));
    click('Nouveau dossier');

    submitName(' Sujets ');

    expect(service.createFolder).toHaveBeenCalledWith('UTC502', 'Sujets', 1);
    expect(service.listFolders).toHaveBeenCalledTimes(2);
    expect(element().querySelector('form')).toBeNull();
  });

  it('affiche le refus d’un nom de dossier déjà pris', () => {
    setup();
    service.createFolder.mockReturnValue(
      throwError(() => new ApiError(409, ['Un dossier « TD » existe déjà à cet endroit.'])),
    );
    click('Nouveau dossier');

    submitName('TD');

    expect(text()).toContain('Un dossier « TD » existe déjà à cet endroit.');
    expect(element().querySelector('form')).not.toBeNull();
  });

  it('renomme un dossier', () => {
    setup();
    service.renameFolder.mockReturnValue(of({ id: 1, parentId: null, name: 'Travaux dirigés' }));
    click('Renommer le dossier TD');
    expect(element().querySelector<HTMLInputElement>('#entry-name')?.value).toBe('TD');

    submitName('Travaux dirigés');

    expect(service.renameFolder).toHaveBeenCalledWith(1, 'Travaux dirigés');
  });

  it('supprime un dossier après confirmation, et affiche un refus', async () => {
    setup();
    dialog.confirmDeletion.mockResolvedValue(true);
    service.removeFolder.mockReturnValue(
      throwError(() => new ApiError(409, ['Le dossier « TD » n’est pas vide.'])),
    );

    click('Supprimer le dossier TD');
    await settle();

    expect(service.removeFolder).toHaveBeenCalledWith(1);
    expect(text()).toContain('Le dossier « TD » n’est pas vide.');
  });

  it('renomme un fichier, et affiche le refus d’un nom déjà pris', () => {
    setup();
    service.updateFile.mockReturnValue(
      throwError(() => new ApiError(409, ['Un fichier « a.pdf » existe déjà dans ce dossier.'])),
    );
    click('Renommer le fichier notes.pdf');
    expect(element().querySelector<HTMLInputElement>('#entry-name')?.value).toBe('notes.pdf');

    submitName('a.pdf');
    expect(service.updateFile).toHaveBeenCalledWith(7, { name: 'a.pdf' });
    expect(text()).toContain('Un fichier « a.pdf » existe déjà dans ce dossier.');

    service.updateFile.mockReturnValue(of({ ...NOTES, name: 'b.pdf' }));
    submitName('b.pdf');
    expect(element().querySelector('form')).toBeNull();
  });

  it('déplace un fichier vers le dossier choisi et dit sous quel nom', () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    setup();
    service.updateFile.mockReturnValue(of({ ...NOTES, folderId: 2, name: 'notes - 2.pdf' }));
    click('Déplacer le fichier notes.pdf');

    element().querySelectorAll<HTMLInputElement>('app-folder-picker input')[2].click();
    fixture.detectChanges();
    element().querySelector<HTMLButtonElement>('app-folder-picker .button-primary')?.click();
    fixture.detectChanges();

    expect(service.updateFile).toHaveBeenCalledWith(7, { folderId: 2 });
    expect(text()).toContain(
      'notes.pdf : Déplacé vers « Corrigés », sous le nom « notes - 2.pdf ».',
    );
    expect(element().querySelector('app-folder-picker')).toBeNull();
  });

  it('supprime un fichier après confirmation seulement', async () => {
    setup();
    dialog.confirmDeletion.mockResolvedValue(false);
    service.removeFile.mockReturnValue(of(undefined));

    click('Supprimer le fichier notes.pdf');
    await settle();
    expect(dialog.confirmDeletion).toHaveBeenCalledWith(
      'Supprimer le fichier',
      '« notes.pdf » sera supprimé définitivement.',
    );
    expect(service.removeFile).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    click('Supprimer le fichier notes.pdf');
    await settle();
    expect(service.removeFile).toHaveBeenCalledWith(7);
    expect(service.listFiles).toHaveBeenCalledTimes(2);
  });

  it('envoie les fichiers un par un et rend compte de chacun', () => {
    setup(1, []);
    const first = new File(['a'], 'notes.pdf');
    const second = new File(['b'], 'refusé.pdf');
    service.upload
      .mockReturnValueOnce(of({ ...NOTES, name: 'notes - 2.pdf' }))
      .mockReturnValueOnce(throwError(() => new ApiError(400, ['Aucun fichier reçu.'])));

    pick(first, second);

    expect(service.upload).toHaveBeenNthCalledWith(1, 'UTC502', 1, first);
    expect(service.upload).toHaveBeenNthCalledWith(2, 'UTC502', 1, second);
    expect(text()).toContain('notes.pdf : Enregistré sous « notes - 2.pdf ».');
    expect(text()).toContain('refusé.pdf : Aucun fichier reçu.');
    expect(service.listFiles).toHaveBeenCalledTimes(2);
  });

  it('refuse un fichier trop gros sans l’envoyer', () => {
    setup();
    const big = new File(['x'], 'gros.bin');
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 + 1 });
    const small = new File(['x'], 'petit.txt');
    service.upload.mockReturnValue(of({ ...NOTES, name: 'petit.txt' }));

    pick(big, small);

    expect(service.upload).toHaveBeenCalledExactlyOnceWith('UTC502', null, small);
    expect(text()).toContain('gros.bin : Le fichier dépasse la taille maximale de 50 Mo.');
    expect(text()).toContain('petit.txt : Envoyé.');
  });

  it('envoie les fichiers déposés sur la liste', () => {
    setup();
    const file = new File(['a'], 'déposé.pdf');
    service.upload.mockReturnValue(of({ ...NOTES, name: 'déposé.pdf' }));
    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file], types: ['Files'] } });

    element().dispatchEvent(drop);
    fixture.detectChanges();

    expect(drop.defaultPrevented).toBe(true);
    expect(service.upload).toHaveBeenCalledWith('UTC502', null, file);
  });

  describe('glisser-déposer', () => {
    // Événement de glisser tel que le navigateur l'envoie, avec de quoi porter des données.
    function drag(target: Element | null, type: string): Event {
      const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        dataTransfer: { setData: vi.fn(), effectAllowed: 'none', types: [] },
      });
      target?.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    }

    const fileRow = (): Element | null => element().querySelector('li.entry:not(.is-folder)');
    const folderRow = (): Element | null => element().querySelector('li.entry.is-folder');
    const pathLinks = (): Element[] => Array.from(element().querySelectorAll('.path a'));

    it('déplace un fichier glissé sur un dossier', () => {
      setup();
      service.updateFile.mockReturnValue(of({ ...NOTES, folderId: 1 }));

      drag(fileRow(), 'dragstart');
      expect(fileRow()?.classList).toContain('is-dragged');
      const over = drag(folderRow(), 'dragover');
      expect(over.defaultPrevented).toBe(true);
      expect(folderRow()?.classList).toContain('is-drop-target');

      drag(folderRow(), 'drop');

      expect(service.updateFile).toHaveBeenCalledWith(7, { folderId: 1 });
      expect(text()).toContain('Déplacé vers « TD »');
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('remonte un dossier glissé sur le chemin', () => {
      setup(1, []);
      service.moveFolder.mockReturnValue(of({ id: 2, parentId: null, name: 'Corrigés' }));

      drag(folderRow(), 'dragstart');
      drag(pathLinks()[0], 'dragover');
      drag(pathLinks()[0], 'drop');

      expect(service.moveFolder).toHaveBeenCalledWith(2, null);
    });

    it('refuse un dépôt sans effet : là où l’élément se trouve déjà, ou un dossier sur lui-même', () => {
      setup();

      drag(fileRow(), 'dragstart');
      expect(drag(pathLinks()[0], 'dragover').defaultPrevented).toBe(false);
      drag(pathLinks()[0], 'drop');
      drag(fileRow(), 'dragend');

      drag(folderRow(), 'dragstart');
      expect(drag(folderRow(), 'dragover').defaultPrevented).toBe(false);
      drag(folderRow(), 'drop');

      expect(service.updateFile).not.toHaveBeenCalled();
      expect(service.moveFolder).not.toHaveBeenCalled();
    });

    it('affiche le refus de l’API', () => {
      setup();
      service.updateFile.mockReturnValue(
        throwError(() => new ApiError(400, ['Ce dossier n’existe pas dans cette UE.'])),
      );

      drag(fileRow(), 'dragstart');
      drag(folderRow(), 'dragover');
      drag(folderRow(), 'drop');

      expect(text()).toContain('Ce dossier n’existe pas dans cette UE.');
    });
  });
});
