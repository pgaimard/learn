import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { CourseContent } from '../cours/content/course-content';
import { CommandList } from './command-list';
import { Command, CommandService } from './command.service';
import { Tool, ToolService } from './tool.service';

// Page d'un outil, en deux volets : son fonctionnement (fiche et modes) et ses commandes.
@Component({
  selector: 'app-tool-read-page',
  imports: [CommandList, CourseContent, Icon, RouterLink],
  templateUrl: './tool-read-page.html',
  styleUrl: './tool-read-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolReadPage {
  // Paramètre de la route /outils/:id.
  readonly id = input.required<string>();
  // Paramètres de requête : ?volet=commandes montre les commandes, ?commande=n déplie
  // celle qui porte ce numéro.
  readonly volet = input<string>();
  readonly commande = input<string>();

  private readonly toolService = inject(ToolService);
  private readonly commandService = inject(CommandService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  protected readonly tool = signal<Tool | null>(null);
  protected readonly commands = signal<Command[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly showsCommands = computed(() => this.volet() === 'commandes');
  protected readonly openCommandId = computed(() => {
    const id = Number(this.commande());
    return Number.isInteger(id) && id > 0 ? id : null;
  });

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
      `« ${tool.name} », ses modes, ses déclinaisons et ses commandes seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.toolService.remove(tool.id).subscribe({
      next: () => void this.router.navigateByUrl('/outils'),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected async removeCommand(tool: Tool, command: Command): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer la commande',
      `« ${command.name} », ses options et ses exemples seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.commandService.remove(tool.id, command.id).subscribe({
      next: () => this.loadCommands(tool.id),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  private loadCommands(toolId: number): void {
    this.commandService.list(toolId).subscribe({
      next: (commands) => this.commands.set(commands),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  private load(id: number): void {
    this.tool.set(null);
    this.commands.set([]);
    this.errors.set([]);
    this.loadCommands(id);
    this.toolService.get(id).subscribe({
      next: (tool) => {
        this.tool.set(tool);
        this.title.setTitle(tool.name);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
