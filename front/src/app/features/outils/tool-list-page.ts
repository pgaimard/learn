import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { ToolService, ToolSummary } from './tool.service';

// Liste des outils : on entre par l'outil pour lire son fonctionnement et ses commandes.
@Component({
  selector: 'app-tool-list-page',
  imports: [Icon, RouterLink],
  templateUrl: './tool-list-page.html',
  styleUrl: './tool-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolListPage {
  private readonly toolService = inject(ToolService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);

  // null tant que la liste n'est pas chargée.
  protected readonly tools = signal<ToolSummary[] | null>(null);
  protected readonly errors = signal<string[]>([]);

  constructor() {
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
