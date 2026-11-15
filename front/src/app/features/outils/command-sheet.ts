import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../core/ui/icon';
import { CommandLine } from './command-line';
import { Command } from './command.service';
import { Tool, ToolVariant } from './tool.service';

const COPIED_NOTICE_MS = 1500;

// Fiche d'une commande : syntaxe colorée, options, exemples à copier, notes et renvois
// vers les commandes de même nom des autres outils.
@Component({
  selector: 'app-command-sheet',
  imports: [CommandLine, Icon, RouterLink],
  templateUrl: './command-sheet.html',
  styleUrl: './command-sheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandSheet {
  readonly command = input.required<Command>();
  readonly tool = input.required<Tool>();
  // Demande de suppression : la page confirme et supprime.
  readonly removed = output<void>();

  // Mode de l'outil où la commande se tape.
  protected readonly mode = computed(
    () => this.tool().modes.find((mode) => mode.id === this.command().modeId) ?? null,
  );
  // Rang de l'exemple qui vient d'être copié, un court instant, pour le dire sur le bouton.
  protected readonly copied = signal<number | null>(null);

  protected variants(ids: number[]): ToolVariant[] {
    return this.tool().variants.filter((variant) => ids.includes(variant.id));
  }

  protected async copy(line: string, index: number): Promise<void> {
    await navigator.clipboard.writeText(line);
    this.copied.set(index);
    setTimeout(() => this.copied.set(null), COPIED_NOTICE_MS);
  }
}
