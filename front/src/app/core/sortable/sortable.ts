import { Directive, ElementRef, inject, input, output, signal } from '@angular/core';

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

// Liste dont les éléments se réordonnent en les faisant glisser par leur poignée,
// ou au clavier depuis la poignée. La liste elle-même ne change rien : elle annonce
// le déplacement demandé, que la page applique.
@Directive({ selector: '[appSortableList]' })
export class SortableList {
  readonly sorted = output<SortChange>();

  // Rang de l'élément en cours de déplacement.
  readonly dragged = signal<number | null>(null);
  // Frontière visée : 0 avant le premier élément, n après le dernier.
  readonly boundary = signal<number | null>(null);

  complete(): void {
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

  cancel(): void {
    this.dragged.set(null);
    this.boundary.set(null);
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
    '(dragover)': 'aim($event)',
    '(drop)': 'drop($event)',
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

  arm(): void {
    this.isArmed.set(true);
  }

  disarm(): void {
    this.isArmed.set(false);
  }

  move(step: -1 | 1): void {
    this.list.sorted.emit({ from: this.index(), to: this.index() + step });
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
    this.list.dragged.set(this.index());
  }

  protected aim(event: DragEvent): void {
    if (this.list.dragged() === null) {
      return;
    }
    event.preventDefault();
    const box = this.element.nativeElement.getBoundingClientRect();
    const isLowerHalf = event.clientY > box.top + box.height / 2;
    this.list.boundary.set(this.index() + (isLowerHalf ? 1 : 0));
  }

  protected drop(event: DragEvent): void {
    if (this.list.dragged() !== null) {
      event.preventDefault();
      this.list.complete();
    }
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
