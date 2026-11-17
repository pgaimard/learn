import { Directive, ElementRef, inject, input, output } from '@angular/core';

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

// Poignée d'un élément triable. Le glisser est celui du cdk (cdkDragHandle) ; cette
// directive y ajoute le clavier : flèches haut et bas pour déplacer l'élément d'un rang.
@Directive({
  selector: '[appSortKeys]',
  host: {
    '(keydown.arrowup)': 'move($event, -1)',
    '(keydown.arrowdown)': 'move($event, 1)',
  },
})
export class SortKeys {
  // Rang de l'élément dans sa liste.
  readonly index = input.required<number>({ alias: 'appSortKeys' });
  readonly sorted = output<SortChange>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected move(event: Event, step: -1 | 1): void {
    event.preventDefault();
    this.sorted.emit({ from: this.index(), to: this.index() + step });
    // L'élément vient de changer de place dans la page : la poignée garde le focus.
    setTimeout(() => this.element.nativeElement.focus());
  }
}
