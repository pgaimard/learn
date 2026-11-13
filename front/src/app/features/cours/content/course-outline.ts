import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Icon } from '../../../core/ui/icon';
import { OutlineEntry } from './build-outline';

const STORAGE_KEY = 'outline-collapsed';

// Sommaire d'un cours : ses titres, celui de la section affichée mis en avant. Il se
// rabat sur son seul titre ; le choix est gardé dans le navigateur.
@Component({
  selector: 'app-course-outline',
  imports: [Icon],
  template: `
    <h2 [id]="headingId()">
      <button
        type="button"
        class="toggle"
        [attr.aria-expanded]="!collapsed()"
        [attr.aria-controls]="headingId() + '-list'"
        (click)="toggle()"
      >
        <app-icon [name]="collapsed() ? 'chevron-right' : 'chevron-down'" [size]="13" />
        {{ heading() }}
      </button>
    </h2>
    <nav [id]="headingId() + '-list'" [attr.aria-labelledby]="headingId()" [hidden]="collapsed()">
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

  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  protected readonly collapsed = signal(this.readChoice());

  protected toggle(): void {
    this.collapsed.update((collapsed) => !collapsed);
    try {
      this.storage?.setItem(STORAGE_KEY, String(this.collapsed()));
    } catch {
      // Stockage refusé (navigation privée) : le choix vaut pour la page en cours.
    }
  }

  private readChoice(): boolean {
    try {
      return this.storage?.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
