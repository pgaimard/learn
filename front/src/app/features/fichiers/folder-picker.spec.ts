import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Folder } from './file.service';
import { FolderPicker } from './folder-picker';

const FOLDERS: Folder[] = [
  { id: 1, parentId: null, name: 'TD' },
  { id: 2, parentId: 1, name: 'Corrigés' },
];

describe('FolderPicker', () => {
  let fixture: ComponentFixture<FolderPicker>;
  let picked: (number | null)[];

  function setup(currentFolderId: number | null): void {
    // jsdom n'ouvre pas les boîtes de dialogue : seul l'appel compte ici.
    HTMLDialogElement.prototype.showModal = vi.fn();
    fixture = TestBed.createComponent(FolderPicker);
    fixture.componentRef.setInput('fileName', 'notes.pdf');
    fixture.componentRef.setInput('folders', FOLDERS);
    fixture.componentRef.setInput('currentFolderId', currentFolderId);
    picked = [];
    fixture.componentInstance.picked.subscribe((folderId) => picked.push(folderId));
    fixture.detectChanges();
  }

  function radios(): HTMLInputElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input'),
    );
  }

  function moveButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'button.button-primary',
    ) as HTMLButtonElement;
  }

  it('propose la racine et tous les dossiers, sauf l’emplacement actuel', () => {
    setup(1);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(radios().map((radio) => radio.disabled)).toEqual([false, true, false]);
    expect(moveButton().disabled).toBe(true);
  });

  it('émet le dossier choisi', () => {
    setup(null);

    radios()[2].click();
    fixture.detectChanges();
    moveButton().click();

    expect(picked).toEqual([2]);
  });

  it('émet null pour la racine de l’UE', () => {
    setup(2);

    radios()[0].click();
    fixture.detectChanges();
    moveButton().click();

    expect(picked).toEqual([null]);
  });
});
