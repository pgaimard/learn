import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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

  protected readonly screens = TERM_SCREENS;
}
