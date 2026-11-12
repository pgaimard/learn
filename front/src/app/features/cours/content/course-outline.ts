import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OutlineEntry } from './build-outline';

// Sommaire d'un cours : ses titres, celui de la section affichée mis en avant.
@Component({
  selector: 'app-course-outline',
  template: `
    <h2 [id]="headingId()">{{ heading() }}</h2>
    <nav [attr.aria-labelledby]="headingId()">
      <ol>
        @for (entry of entries(); track entry.index) {
          <li>
            <button
              type="button"
              [class]="'level-' + entry.level"
              [class.is-current]="entry.index === activeIndex()"
              [attr.aria-current]="entry.index === activeIndex() ? 'location' : null"
              (click)="picked.emit(entry.index)"
            >
              {{ entry.text }}
            </button>
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './course-outline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseOutline {
  readonly entries = input.required<OutlineEntry[]>();
  readonly heading = input('Sommaire');
  readonly headingId = input('course-outline-title');
  // Rang du titre de la section affichée ; null s'il n'y en a pas.
  readonly activeIndex = input<number | null>(null);

  readonly picked = output<number>();
}
