import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { CourseContent } from '../cours/content/course-content';
import { Tool, ToolService } from './tool.service';

// Page d'un outil : sa présentation, ses déclinaisons, ses modes et son fonctionnement.
@Component({
  selector: 'app-tool-read-page',
  imports: [CourseContent, Icon, RouterLink],
  templateUrl: './tool-read-page.html',
  styleUrl: './tool-read-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolReadPage {
  // Paramètre de la route /outils/:id.
  readonly id = input.required<string>();

  private readonly toolService = inject(ToolService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  protected readonly tool = signal<Tool | null>(null);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  // La fiche n'est affichée que si elle contient quelque chose.
  protected hasContent(tool: Tool): boolean {
    const blocks = tool.content.content ?? [];
    return blocks.some((block) => block.type !== 'paragraph' || (block.content ?? []).length > 0);
  }

  protected async remove(tool: Tool): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer l’outil',
      `« ${tool.name} », ses modes et ses déclinaisons seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.toolService.remove(tool.id).subscribe({
      next: () => void this.router.navigateByUrl('/outils'),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  private load(id: number): void {
    this.tool.set(null);
    this.toolService.get(id).subscribe({
      next: (tool) => {
        this.tool.set(tool);
        this.title.setTitle(tool.name);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
