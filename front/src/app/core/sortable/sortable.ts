import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject, input, output, signal } from '@angular/core';

export interface SortChange {
  // Rang de l'élément déplacé, et rang où il arrive.
  from: number;
  to: number;
}

// Nouvelle liste où l'élément de rang « from » est passé au rang « to ».
// La liste est rendue telle quelle si le déplacement n'a pas de sens.
export function moveItem<T>(items: readonly T[], { from, to }: SortChange): T[] {
  const moved = [...items];
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return moved;
  }
  moved.splice(to, 0, ...moved.splice(from, 1));
  return moved;
}

interface Pointer {
  clientX: number;
  clientY: number;
}

// Un élément précède-t-il la souris dans l'ordre de lecture ? En liste, son milieu est
// au-dessus d'elle. En grille, il est sur une rangée plus haute, ou sur la même rangée
// avec son milieu à gauche.
export function precedes(
  box: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width' | 'height'>,
  pointer: Pointer,
  grid: boolean,
): boolean {
  if (!grid) {
    return pointer.clientY > box.top + box.height / 2;
  }
  return (
    pointer.clientY > box.bottom ||
    (pointer.clientY >= box.top && pointer.clientX > box.left + box.width / 2)
  );
}

// Liste dont les éléments se réordonnent en les faisant glisser par leur poignée,
// ou au clavier depuis la poignée. La liste elle-même ne change rien : elle annonce
// le déplacement demandé, que la page applique.
@Directive({ selector: '[appSortableList]', host: { '[class.is-grid]': 'appSortableGrid()' } })
export class SortableList {
  readonly sorted = output<SortChange>();
  // Éléments disposés en grille (plusieurs par rangée) plutôt qu'en liste.
  readonly appSortableGrid = input(false);

  // Rang de l'élément en cours de déplacement.
  readonly dragged = signal<number | null>(null);
  // Frontière visée : 0 avant le premier élément, n après le dernier.
  readonly boundary = signal<number | null>(null);

  private readonly document = inject(DOCUMENT);
  private readonly items = new Set<SortableItem>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopListening());
  }

  register(item: SortableItem): void {
    this.items.add(item);
  }

  unregister(item: SortableItem): void {
    this.items.delete(item);
  }

  // Début d'un glisser. La cible se suit dans toute la page et non sur les seuls
  // éléments : on peut ainsi déposer dans l'espace entre deux éléments, ou sous la
  // liste pour placer l'élément en dernier.
  begin(index: number): void {
    this.dragged.set(index);
    this.document.addEventListener('dragover', this.aim);
    this.document.addEventListener('drop', this.drop);
  }

  cancel(): void {
    this.stopListening();
    this.dragged.set(null);
    this.boundary.set(null);
  }

  private complete(): void {
    const from = this.dragged();
    const boundary = this.boundary();
    this.cancel();
    if (from === null || boundary === null) {
      return;
    }
    const to = boundary > from ? boundary - 1 : boundary;
    if (to !== from) {
      this.sorted.emit({ from, to });
    }
  }

  // La frontière visée est celle qui suit les éléments dont le milieu est au-dessus
  // de la souris : au-dessus de la liste c'est la première, en dessous la dernière.
  private readonly aim = (event: DragEvent): void => {
    event.preventDefault();
    let boundary = 0;
    for (const item of this.items) {
      if (item.isBefore(event, this.appSortableGrid())) {
        boundary += 1;
      }
    }
    this.boundary.set(boundary);
  };

  private readonly drop = (event: DragEvent): void => {
    event.preventDefault();
    this.complete();
  };

  private stopListening(): void {
    this.document.removeEventListener('dragover', this.aim);
    this.document.removeEventListener('drop', this.drop);
  }
}

@Directive({
  selector: '[appSortableItem]',
  host: {
    '[attr.draggable]': 'isArmed() ? "true" : null',
    '[class.is-dragged]': 'list.dragged() === index()',
    '[class.drop-before]': 'isTarget(0)',
    '[class.drop-after]': 'appSortableLast() && isTarget(1)',
    '(dragstart)': 'start($event)',
    '(dragend)': 'end()',
  },
})
export class SortableItem {
  readonly index = input.required<number>({ alias: 'appSortableItem' });
  // Dernier élément de la liste : il peut aussi montrer un dépôt après lui.
  readonly appSortableLast = input(false);

  protected readonly list = inject(SortableList);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  // L'élément ne se laisse glisser que si le geste part de sa poignée : son texte et
  // ses liens restent utilisables normalement.
  protected readonly isArmed = signal(false);

  constructor() {
    this.list.register(this);
    inject(DestroyRef).onDestroy(() => this.list.unregister(this));
  }

  arm(): void {
    this.isArmed.set(true);
  }

  disarm(): void {
    this.isArmed.set(false);
  }

  move(step: -1 | 1): void {
    this.list.sorted.emit({ from: this.index(), to: this.index() + step });
  }

  isBefore(pointer: Pointer, grid: boolean): boolean {
    return precedes(this.element.nativeElement.getBoundingClientRect(), pointer, grid);
  }

  protected isTarget(offset: 0 | 1): boolean {
    const from = this.list.dragged();
    const boundary = this.list.boundary();
    // Un dépôt qui ne changerait rien n'est pas signalé.
    return (
      from !== null &&
      boundary === this.index() + offset &&
      boundary !== from &&
      boundary !== from + 1
    );
  }

  protected start(event: DragEvent): void {
    if (!this.isArmed() || !event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');
    this.list.begin(this.index());
  }

  protected end(): void {
    this.disarm();
    this.list.cancel();
  }
}

// Poignée d'un élément : on la saisit pour le faire glisser, ou on la prend au clavier
// et on déplace l'élément avec les flèches haut et bas.
@Directive({
  selector: '[appSortableHandle]',
  host: {
    '(mousedown)': 'item.arm()',
    '(mouseup)': 'item.disarm()',
    '(keydown.arrowup)': 'move($event, -1)',
    '(keydown.arrowdown)': 'move($event, 1)',
  },
})
export class SortableHandle {
  protected readonly item = inject(SortableItem);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected move(event: Event, step: -1 | 1): void {
    event.preventDefault();
    this.item.move(step);
    // L'élément vient de changer de place dans la page : la poignée garde le focus.
    setTimeout(() => this.element.nativeElement.focus());
  }
}
