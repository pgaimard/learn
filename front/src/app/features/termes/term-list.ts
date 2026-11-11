import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TERM_SCREENS } from './term-screens';
import { TermSummary } from './term.service';

// Liste de termes, chacun menant à sa page dans le dictionnaire ou le glossaire.
@Component({
  selector: 'app-term-list',
  imports: [RouterLink],
  templateUrl: './term-list.html',
  styleUrl: './term-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermList {
  readonly terms = input.required<TermSummary[]>();
  // Affiche « Modifier » et « Supprimer » sur chaque terme.
  readonly showActions = input(false);

  // Suppression demandée ; la confirmation et l'appel sont faits par la page.
  readonly removed = output<TermSummary>();

  protected readonly screens = TERM_SCREENS;
}
