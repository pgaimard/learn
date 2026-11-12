import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, concatMap, forkJoin, from, map, Observable, of, toArray } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { FileService, Folder, MAX_FILE_SIZE, StoredFile } from './file.service';
import { FolderPicker } from './folder-picker';
import { childrenOf, pathTo } from './folder-tree';
import { formatSize } from './format-size';
import { NameForm } from './name-form';

// Formulaire ouvert : création d'un dossier ici, ou renommage du dossier ou du fichier désigné.
type Editing =
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; id: number }
  | { kind: 'rename-file'; id: number }
  | null;

// Compte rendu d'un envoi ou d'un déplacement.
interface UploadReport {
  name: string;
  succeeded: boolean;
  message: string;
}

// Fichiers et dossiers d'une UE : parcours, gestion des dossiers, envoi et téléchargement.
@Component({
  selector: 'app-file-browser',
  imports: [DatePipe, FolderPicker, Icon, Modal, NameForm, RouterLink],
  templateUrl: './file-browser.html',
  styleUrl: './file-browser.css',
  host: {
    '[class.is-dragging]': 'isDragging()',
    '(dragover)': 'allowDrop($event)',
    '(dragleave)': 'isDragging.set(false)',
    '(drop)': 'receiveDrop($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileBrowser {
  readonly ueCode = input.required<string>();
  // Dossier affiché ; null pour la racine de l'UE.
  readonly folderId = input<number | null>(null);

  private readonly fileService = inject(FileService);
  private readonly dialog = inject(DialogService);

  protected readonly folders = signal<Folder[]>([]);
  protected readonly files = signal<StoredFile[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errors = signal<string[]>([]);
  protected readonly editing = signal<Editing>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly isDragging = signal(false);
  protected readonly reports = signal<UploadReport[]>([]);
  // Fichier dont on choisit la destination dans la boîte « Déplacer vers… ».
  protected readonly moving = signal<StoredFile | null>(null);

  protected readonly path = computed(() => pathTo(this.folders(), this.folderId()));
  protected readonly subfolders = computed(() => childrenOf(this.folders(), this.folderId()));
  protected readonly isEmpty = computed(
    () => this.subfolders().length === 0 && this.files().length === 0,
  );

  protected readonly formatSize = formatSize;
  // Titre de la fenêtre selon le formulaire ouvert.
  protected readonly headings = {
    'new-folder': 'Nouveau dossier',
    'rename-folder': 'Renommer le dossier',
    'rename-file': 'Renommer le fichier',
  } as const;
  protected readonly renamedFolder = computed(() => {
    const editing = this.editing();
    return editing?.kind === 'rename-folder'
      ? this.folders().find((folder) => folder.id === editing.id)
      : undefined;
  });
  protected readonly renamedFile = computed(() => {
    const editing = this.editing();
    return editing?.kind === 'rename-file'
      ? this.files().find((file) => file.id === editing.id)
      : undefined;
  });
  // Nom du dossier affiché, celui de l'UE à sa racine.
  protected readonly currentName = computed(() => this.path()?.at(-1)?.name ?? this.ueCode());

  constructor() {
    effect(() => {
      this.ueCode();
      this.folderId();
      this.editing.set(null);
      this.reports.set([]);
      this.moving.set(null);
      this.load();
    });
  }

  protected queryFor(folderId: number | null): Record<string, string | number> {
    return folderId === null ? { onglet: 'fichiers' } : { onglet: 'fichiers', dossier: folderId };
  }

  protected downloadUrl(file: StoredFile): string {
    return this.fileService.downloadUrl(file.id);
  }

  protected open(editing: Editing): void {
    this.formErrors.set([]);
    this.editing.set(editing);
  }

  protected renameFile(file: StoredFile, name: string): void {
    this.save(this.fileService.updateFile(file.id, { name }));
  }

  protected moveTo(folderId: number | null): void {
    const file = this.moving();
    if (!file) {
      return;
    }
    this.moving.set(null);
    this.fileService.updateFile(file.id, { folderId }).subscribe({
      next: (moved) => {
        const destination =
          this.folders().find((folder) => folder.id === folderId)?.name ?? 'la racine de l’UE';
        const renamed = moved.name === file.name ? '' : `, sous le nom « ${moved.name} »`;
        this.reports.set([
          {
            name: file.name,
            succeeded: true,
            message: `Déplacé vers « ${destination} »${renamed}.`,
          },
        ]);
        this.load();
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected async removeFile(file: StoredFile): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer le fichier',
      `« ${file.name} » sera supprimé définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.fileService.removeFile(file.id).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected createFolder(name: string): void {
    this.save(this.fileService.createFolder(this.ueCode(), name, this.folderId()));
  }

  protected renameFolder(folder: Folder, name: string): void {
    this.save(this.fileService.renameFolder(folder.id, name));
  }

  protected async removeFolder(folder: Folder): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer le dossier',
      `Le dossier « ${folder.name} » sera supprimé. Il doit être vide.`,
    );
    if (!confirmed) {
      return;
    }
    this.fileService.removeFolder(folder.id).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected pickFiles(event: Event): void {
    const field = event.target as HTMLInputElement;
    this.upload(Array.from(field.files ?? []));
    // Vidé pour que choisir à nouveau les mêmes fichiers relance un envoi.
    field.value = '';
  }

  protected allowDrop(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      this.isDragging.set(true);
    }
  }

  protected receiveDrop(event: DragEvent): void {
    this.isDragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      this.upload(files);
    }
  }

  // Envoie les fichiers un par un : chacun a son propre compte rendu.
  private upload(files: File[]): void {
    if (files.length === 0 || this.isUploading()) {
      return;
    }
    this.isUploading.set(true);
    this.reports.set([]);
    from(files)
      .pipe(
        concatMap((file) => this.send(file)),
        toArray(),
      )
      .subscribe((reports) => {
        this.reports.set(reports);
        this.isUploading.set(false);
        this.load();
      });
  }

  private send(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      return of(failure(file.name, 'Le fichier dépasse la taille maximale de 50 Mo.'));
    }
    return this.fileService.upload(this.ueCode(), this.folderId(), file).pipe(
      map((stored): UploadReport => ({
        name: file.name,
        succeeded: true,
        message: stored.name === file.name ? 'Envoyé.' : `Enregistré sous « ${stored.name} ».`,
      })),
      catchError((error: ApiError) => of(failure(file.name, error.messages.join(' ')))),
    );
  }

  // Enregistre le formulaire de nom ouvert, puis le ferme et recharge la liste.
  private save(request: Observable<unknown>): void {
    if (this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.formErrors.set(error.messages);
      },
    });
  }

  private load(): void {
    forkJoin({
      folders: this.fileService.listFolders(this.ueCode()),
      files: this.fileService.listFiles(this.ueCode(), this.folderId()),
    }).subscribe({
      next: ({ folders, files }) => {
        this.folders.set(folders);
        this.files.set(files);
        this.errors.set([]);
        this.isLoading.set(false);
      },
      error: (error: ApiError) => {
        this.files.set([]);
        this.errors.set(error.messages);
        this.isLoading.set(false);
      },
    });
  }
}

function failure(name: string, message: string): UploadReport {
  return { name, succeeded: false, message };
}
