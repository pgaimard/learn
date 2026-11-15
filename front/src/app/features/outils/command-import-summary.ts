import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommandImportPreview, ImportedCommand } from './command-import.service';

// Ce qu'un import de commandes fera : outils et commandes à créer, commandes déjà
// présentes et la case qui demande de les remplacer.
@Component({
  selector: 'app-command-import-summary',
  template: `
    @let found = preview();
    @if (found.newTools.length > 0) {
      <p class="block">
        <strong>{{ plural(found.newTools.length, 'outil') }} à créer :</strong>
        {{ found.newTools.join(', ') }}
      </p>
    }
    @if (found.newCommands.length > 0) {
      <p class="block">
        <strong>{{ plural(found.newCommands.length, 'commande') }} à ajouter :</strong>
        {{ labelsOf(found.newCommands) }}
      </p>
    }
    @if (found.duplicateCommands.length > 0) {
      <div class="block duplicates" role="status">
        <p>
          <strong>{{ plural(found.duplicateCommands.length, 'commande') }} déjà en place :</strong>
          {{ labelsOf(found.duplicateCommands) }}
        </p>
        <label class="check">
          <input type="checkbox" [checked]="replace()" (change)="toggle($event)" />
          Les remplacer par celles du fichier (sinon elles restent telles quelles)
        </label>
      </div>
    }
  `,
  styles: `
    .block {
      margin: 0 0 0.5rem;
      padding: 0.4375rem 0.625rem;
      border-radius: var(--radius);
      background: var(--color-callout-retenir-soft);
      font-size: 0.75rem;
    }

    .duplicates {
      background: var(--color-callout-attention-soft);
    }

    .duplicates p {
      margin: 0 0 0.375rem;
    }

    .check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandImportSummary {
  readonly preview = input.required<CommandImportPreview>();
  // Remplacer les commandes déjà présentes par celles du fichier.
  readonly replace = model(false);

  protected toggle(event: Event): void {
    this.replace.set((event.target as HTMLInputElement).checked);
  }

  protected plural(count: number, noun: string): string {
    return `${count} ${noun}${count > 1 ? 's' : ''}`;
  }

  protected labelsOf(commands: ImportedCommand[]): string {
    return commands.map((command) => `${command.name} (${command.tool})`).join(', ');
  }
}
