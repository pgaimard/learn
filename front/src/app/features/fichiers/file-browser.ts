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
import { catchError, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { FileService, Folder, MAX_FILE_SIZE, StoredFile } from './file.service';
import { childrenOf, pathTo } from './folder-tree';
import { formatSize } from './format-size';
import { NameForm } from './name-form';

// Formulaire ouvert : création d'un dossier ici, ou renommage du dossier désigné.
type Editing = { kind: 'new-folder' } | { kind: 'rename-folder'; id: number } | null;

interface UploadReport {
  name: string;
  succeeded: boolean;
  message: string;
}

// Fichiers et dossiers d'une UE : parcours, gestion des dossiers, envoi et téléchargement.
@Component({
  selector: 'app-file-browser',
  imports: [DatePipe, NameForm, RouterLink],
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

  protected readonly path = computed(() => pathTo(this.folders(), this.folderId()));
  protected readonly subfolders = computed(() => childrenOf(this.folders(), this.folderId()));
  protected readonly isEmpty = computed(
    () => this.subfolders().length === 0 && this.files().length === 0,
  );

  protected readonly formatSize = formatSize;

  constructor() {
    effect(() => {
      this.ueCode();
      this.folderId();
      this.editing.set(null);
      this.reports.set([]);
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

  protected isRenaming(folder: Folder): boolean {
    const editing = this.editing();
    return editing?.kind === 'rename-folder' && editing.id === folder.id;
  }

  protected createFolder(name: string): void {
    this.saveFolder(this.fileService.createFolder(this.ueCode(), name, this.folderId()));
  }

  protected renameFolder(folder: Folder, name: string): void {
    this.saveFolder(this.fileService.renameFolder(folder.id, name));
  }

  protected removeFolder(folder: Folder): void {
    if (!confirm(`Supprimer le dossier « ${folder.name} » ?`)) {
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

  private saveFolder(request: ReturnType<FileService['createFolder']>): void {
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
