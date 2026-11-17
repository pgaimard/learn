import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
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
              [class.is-marked]="entry.index === markedIndex()"
              [attr.aria-current]="entry.index === activeIndex() ? 'location' : null"
              (click)="picked.emit(entry.index)"
            >
              {{ entry.text }}
              @if (entry.index === markedIndex()) {
                <span class="visually-hidden">(marque-page)</span>
              }
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
  // Rang du titre qui porte le marque-page de lecture, signalé d'un point vert.
  readonly markedIndex = input<number | null>(null);

  readonly picked = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Le sommaire suit la lecture : quand la section affichée change, son titre est
    // ramené dans la partie visible du sommaire s'il en était sorti.
    afterRenderEffect(() => {
      if (this.activeIndex() !== null) {
        revealIn(this.host.nativeElement);
      }
    });
  }
}

// Fait défiler le conteneur du sommaire, et lui seul, pour montrer le titre en cours :
// la page, elle, ne bouge pas.
function revealIn(host: HTMLElement): void {
  const current = host.querySelector<HTMLElement>('.is-current');
  const scroller = scrollerOf(host);
  if (!current || !scroller) {
    return;
  }
  const box = current.getBoundingClientRect();
  const frame = scroller.getBoundingClientRect();
  if (box.top < frame.top || box.bottom > frame.bottom) {
    // Au milieu : les titres voisins, avant et après, restent visibles.
    scroller.scrollTop += box.top - frame.top - (frame.height - box.height) / 2;
  }
}

// Premier ancêtre qui défile verticalement ; null si le sommaire tient en entier.
function scrollerOf(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (
      (overflow === 'auto' || overflow === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
  }
  return null;
}
