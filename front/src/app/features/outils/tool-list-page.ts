import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { CommandImportSummary } from './command-import-summary';
import { CommandImportPreview, CommandImportService } from './command-import.service';
import { ToolService, ToolSummary } from './tool.service';

// Liste des outils : on entre par l'outil pour lire son fonctionnement et ses commandes.
@Component({
  selector: 'app-tool-list-page',
  imports: [CommandImportSummary, Icon, Modal, RouterLink],
  templateUrl: './tool-list-page.html',
  styleUrl: './tool-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolListPage {
  private readonly toolService = inject(ToolService);
  private readonly importService = inject(CommandImportService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);

  // null tant que la liste n'est pas chargée.
  protected readonly tools = signal<ToolSummary[] | null>(null);
  protected readonly errors = signal<string[]>([]);

  // Import d'un fichier commandes.json : fenêtre ouverte, contenu du fichier choisi, ce
  // que l'import en fera, et ce qui l'empêche.
  protected readonly isImporting = signal(false);
  protected readonly importPreview = signal<CommandImportPreview | null>(null);
  protected readonly replaceCommands = signal(false);
  protected readonly importErrors = signal<string[]>([]);
  protected readonly isBusy = signal(false);
  private importContent = '';

  constructor() {
    this.load();
  }

  protected openImport(): void {
    this.importPreview.set(null);
    this.importErrors.set([]);
    this.replaceCommands.set(false);
    this.isImporting.set(true);
  }

  // Lit le fichier choisi et demande ce que l'import en ferait.
  protected async pickFile(event: Event): Promise<void> {
    const field = event.target as HTMLInputElement;
    const file = field.files?.item(0);
    field.value = '';
    if (!file) {
      return;
    }
    this.importContent = await file.text();
    this.importErrors.set([]);
    this.isBusy.set(true);
    this.importService.preview(this.importContent).subscribe({
      next: (preview) => {
        this.isBusy.set(false);
        this.importPreview.set(preview);
      },
      error: (error: ApiError) => this.failImport(error),
    });
  }

  protected confirmImport(): void {
    if (this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    this.importService.import(this.importContent, this.replaceCommands()).subscribe({
      next: () => {
        this.isBusy.set(false);
        this.isImporting.set(false);
        this.load();
      },
      error: (error: ApiError) => this.failImport(error),
    });
  }

  private failImport(error: ApiError): void {
    this.isBusy.set(false);
    this.importErrors.set(error.messages);
  }

  private load(): void {
    this.toolService.list().subscribe({
      next: (tools) => this.tools.set(tools),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  // Un outil se crée par son nom ; le reste se remplit sur sa page d'édition.
  protected async create(): Promise<void> {
    const name = await this.dialog.prompt({
      title: 'Nouvel outil',
      label: 'Nom de l’outil',
      initialValue: '',
      hint: 'Par exemple : bash, PowerShell, Cisco IOS, git.',
    });
    if (name === null || name.trim().length === 0) {
      return;
    }
    this.errors.set([]);
    this.toolService.create({ name: name.trim() }).subscribe({
      next: (tool) => void this.router.navigate(['/outils', tool.id, 'edition']),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
