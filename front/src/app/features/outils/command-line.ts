import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { highlightCommand } from './highlight-command';

// Ligne de commande colorée : nom, options, valeurs à fournir.
@Component({
  selector: 'app-command-line',
  template: `@for (token of tokens(); track $index) {
    <span [class]="'token-' + token.kind">{{ token.text }}</span>
  }`,
  styles: `
    :host {
      font-family: var(--font-mono);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .token-name {
      color: var(--color-syntax-keyword);
      font-weight: 600;
    }

    .token-option {
      color: var(--color-syntax-value);
    }

    .token-placeholder {
      color: var(--color-callout-change);
      font-style: italic;
    }

    .token-string {
      color: var(--color-callout-retenir);
    }

    .token-punctuation {
      color: var(--color-syntax-comment);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandLine {
  readonly line = input.required<string>();
  // Nom de la commande, pour le colorer en entier quand il tient en plusieurs mots.
  readonly name = input('');
  // Vrai pour un morceau de commande (une option), sans nom en tête.
  readonly isFragment = input(false);

  protected readonly tokens = computed(() =>
    highlightCommand(this.line(), { name: this.name(), isFragment: this.isFragment() }),
  );
}
