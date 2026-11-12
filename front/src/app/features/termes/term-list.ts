import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../core/ui/icon';
import { groupByLetter, LetterGroup } from './term-letters';
import { TERM_SCREENS } from './term-screens';
import { TermSummary } from './term.service';

// Liste dense de termes, chacun menant à sa page dans le dictionnaire ou le glossaire.
@Component({
  selector: 'app-term-list',
  imports: [Icon, RouterLink],
  templateUrl: './term-list.html',
  styleUrl: './term-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermList {
  readonly terms = input.required<TermSummary[]>();
  // Affiche « Modifier » et « Supprimer » sur chaque terme.
  readonly showActions = input(false);
  // Affiche le type de chaque terme, pour une liste qui mêle définitions et acronymes.
  readonly showType = input(false);
  // Origine affichée : l'UE du terme, ou le cours dont il est issu.
  readonly origin = input<'none' | 'ue' | 'course'>('none');
  // Forme développée et début de la définition dans deux colonnes (glossaire).
  readonly columns = input(false);
  // Regroupe les termes sous leur première lettre.
  readonly grouped = input(false);

  // Suppression demandée ; la confirmation et l'appel sont faits par la page.
  readonly removed = output<TermSummary>();

  protected readonly screens = TERM_SCREENS;
  protected readonly groups = computed<LetterGroup<TermSummary>[]>(() =>
    this.grouped() ? groupByLetter(this.terms()) : [{ letter: '', terms: this.terms() }],
  );
}
