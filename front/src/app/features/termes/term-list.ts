import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../core/ui/icon';
import { TermSummary } from './term.service';

// Liste dense de termes d'une UE, chacun menant à sa page.
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
  // Affiche le cours dont chaque terme est issu.
  readonly showCourse = input(false);

  // Suppression demandée ; la confirmation et l'appel sont faits par la page.
  readonly removed = output<TermSummary>();
}
