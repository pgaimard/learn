import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { moveItem, SortableHandle, SortableItem, SortableList, SortChange } from './sortable';

@Component({
  imports: [SortableHandle, SortableItem, SortableList],
  template: `
    <ul appSortableList (sorted)="changes.push($event); items.set(move($event))">
      @for (item of items(); track item) {
        <li [appSortableItem]="$index" [appSortableLast]="$last">
          <button type="button" appSortableHandle>{{ item }}</button>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly items = signal(['a', 'b', 'c']);
  readonly changes: SortChange[] = [];

  move(change: SortChange): string[] {
    return moveItem(this.items(), change);
  }
}

describe('moveItem', () => {
  it('déplace un élément vers le bas ou vers le haut', () => {
    expect(moveItem(['a', 'b', 'c'], { from: 0, to: 2 })).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], { from: 2, to: 0 })).toEqual(['c', 'a', 'b']);
  });

  it('rend la liste telle quelle pour un déplacement sans effet ou hors limites', () => {
    expect(moveItem(['a', 'b'], { from: 1, to: 1 })).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], { from: 0, to: 2 })).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], { from: -1, to: 0 })).toEqual(['a', 'b']);
  });
});

describe('liste réordonnable', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  function items(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
  }

  function handle(index: number): HTMLButtonElement {
    return items()[index].querySelector('button') as HTMLButtonElement;
  }

  function order(): string[] {
    return items().map((item) => (item.textContent ?? '').trim());
  }

  // Événement de glisser à une hauteur donnée de l'élément (0 en haut, 1 en bas).
  function drag(type: string, index: number, ratio = 0): DragEvent {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: { effectAllowed: '', setData: () => undefined },
    });
    Object.defineProperty(event, 'clientY', { value: ratio * 10 });
    const element = items()[index];
    element.getBoundingClientRect = () => ({ top: 0, height: 10 }) as DOMRect;
    element.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function arm(index: number): void {
    handle(index).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
  }

  it('ne rend un élément glissable que saisi par sa poignée', () => {
    expect(items()[0].getAttribute('draggable')).toBeNull();

    arm(0);
    expect(items()[0].getAttribute('draggable')).toBe('true');

    handle(0).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();
    expect(items()[0].getAttribute('draggable')).toBeNull();
  });

  it('déplace l’élément glissé là où il est déposé', () => {
    arm(0);
    drag('dragstart', 0);
    const over = drag('dragover', 2, 0.9);
    expect(over.defaultPrevented).toBe(true);
    expect(items()[2].classList.contains('drop-after')).toBe(true);

    drag('drop', 2, 0.9);

    expect(fixture.componentInstance.changes).toEqual([{ from: 0, to: 2 }]);
    expect(order()).toEqual(['b', 'c', 'a']);
  });

  it('montre le dépôt avant l’élément survolé dans sa moitié haute', () => {
    arm(2);
    drag('dragstart', 2);
    drag('dragover', 0, 0.1);

    expect(items()[0].classList.contains('drop-before')).toBe(true);
    expect(items()[2].classList.contains('is-dragged')).toBe(true);

    drag('drop', 0, 0.1);
    expect(order()).toEqual(['c', 'a', 'b']);
  });

  it('ne signale ni n’applique un dépôt qui ne change rien', () => {
    arm(1);
    drag('dragstart', 1);
    drag('dragover', 1, 0.9);
    expect(items()[1].classList.contains('drop-before')).toBe(false);

    drag('drop', 1, 0.9);

    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it('abandonne proprement un glisser sans dépôt', () => {
    arm(0);
    drag('dragstart', 0);
    drag('dragover', 2, 0.9);

    drag('dragend', 0);

    expect(items().some((item) => item.className !== '')).toBe(false);
    expect(items()[0].getAttribute('draggable')).toBeNull();
  });

  it('ignore un glisser qui ne part pas de la poignée', () => {
    drag('dragstart', 0);
    const over = drag('dragover', 2, 0.9);

    expect(over.defaultPrevented).toBe(false);
  });

  it('déplace au clavier depuis la poignée et lui rend le focus', () => {
    vi.useFakeTimers();
    document.body.append(fixture.nativeElement as HTMLElement);
    const moved = handle(0);
    moved.focus();

    moved.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    fixture.detectChanges();
    vi.runAllTimers();
    vi.useRealTimers();

    expect(order()).toEqual(['b', 'a', 'c']);
    expect(document.activeElement).toBe(moved);
    (fixture.nativeElement as HTMLElement).remove();
  });
});
