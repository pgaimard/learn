import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../core/ui/icon';
import { Folder } from './file.service';
import { flattenTree } from './folder-tree';

// Boîte de dialogue « Déplacer vers… » : choix d'un dossier de l'UE ou de sa racine.
@Component({
  selector: 'app-folder-picker',
  imports: [Icon],
  templateUrl: './folder-picker.html',
  styleUrl: './folder-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderPicker {
  readonly fileName = input.required<string>();
  // Nom de la racine dans l'arbre : le code de l'UE.
  readonly rootName = input('Racine de l’UE');
  readonly folders = input.required<Folder[]>();
  // Dossier où se trouve le fichier : il ne peut pas être choisi.
  readonly currentFolderId = input.required<number | null>();

  // Dossier choisi ; null pour la racine de l'UE.
  readonly picked = output<number | null>();
  readonly closed = output();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly tree = computed(() => flattenTree(this.folders()));
  // undefined tant que rien n'est choisi.
  protected readonly choice = signal<number | null | undefined>(undefined);

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected confirm(): void {
    const choice = this.choice();
    if (choice !== undefined) {
      this.picked.emit(choice);
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
