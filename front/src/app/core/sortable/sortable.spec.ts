import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { moveItem, SortChange, SortKeys } from './sortable';

@Component({
  imports: [SortKeys],
  template: `
    <ul>
      @for (item of items(); track item) {
        <li>
          <button
            type="button"
            [appSortKeys]="$index"
            (sorted)="changes.push($event); items.set(move($event))"
          >
            {{ item }}
          </button>
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

describe('SortKeys', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  function handles(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  function press(index: number, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    handles()[index].dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  it('déplace l’élément d’un rang avec les flèches, sans faire défiler la page', () => {
    const event = press(0, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.changes).toEqual([{ from: 0, to: 1 }]);
    expect(handles().map((handle) => handle.textContent.trim())).toEqual(['b', 'a', 'c']);

    press(1, 'ArrowUp');
    expect(handles().map((handle) => handle.textContent.trim())).toEqual(['a', 'b', 'c']);
  });

  it('rend le focus à la poignée de l’élément déplacé', async () => {
    document.body.append(fixture.nativeElement as HTMLElement);

    press(0, 'ArrowDown');
    await new Promise((resolve) => setTimeout(resolve));

    expect(document.activeElement?.textContent.trim()).toBe('a');
  });
});
