import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../core/ui/icon';
import { CourseContent } from '../cours/content/course-content';
import { TERM_SCREENS } from './term-screens';
import { Term } from './term.service';

// Un terme en lecture : son libellé, son origine et sa définition, avec ses actions.
@Component({
  selector: 'app-term-detail',
  imports: [CourseContent, Icon, RouterLink],
  templateUrl: './term-detail.html',
  styleUrl: './term-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermDetail {
  readonly term = input.required<Term>();
  // Niveau du titre : 1 quand le terme est le sujet de la page, 2 dans un panneau.
  readonly headingLevel = input<1 | 2>(1);

  // Suppression demandée ; la confirmation et l'appel sont faits par la page.
  readonly removed = output<Term>();

  protected readonly screen = computed(() => TERM_SCREENS[this.term().type]);
}
