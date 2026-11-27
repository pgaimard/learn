import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GridShape } from '../../content/check-grid';
import { TableShape } from './table-commands';
import { TablePicker } from './table-picker';

describe('TablePicker', () => {
  let fixture: ComponentFixture<TablePicker>;
  let host: HTMLElement;
  let picked: TableShape[];
  let closed: number;

  beforeEach(() => {
    fixture = TestBed.createComponent(TablePicker);
    host = fixture.nativeElement as HTMLElement;
    picked = [];
    closed = 0;
    fixture.componentInstance.picked.subscribe((shape) => picked.push(shape));
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.body.append(host);
    fixture.detectChanges();
  });

  afterEach(() => host.remove());

  function fields(): HTMLInputElement[] {
    return Array.from(host.querySelectorAll('input'));
  }

  function set(field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('propose un tableau de 3 × 3 avec une ligne d’en-tête', () => {
    host.querySelector<HTMLButtonElement>('.button-primary')?.click();

    expect(picked).toEqual([{ rows: 3, columns: 3, hasHeaderRow: true, hasHeaderColumn: false }]);
  });

  it('prend la taille de la case survolée, et insère au clic sur la grille', () => {
    const cells = host.querySelectorAll<HTMLElement>('.cell');
    // Deuxième ligne, cinquième colonne d'une grille de dix colonnes.
    cells[14].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(host.querySelectorAll('.cell.is-aimed')).toHaveLength(10);
    expect(host.querySelector('.button-primary')?.textContent.trim()).toBe('Insérer 2 × 5');

    cells[14].click();

    expect(picked[0]).toMatchObject({ rows: 2, columns: 5 });
  });

  it('accepte une taille saisie, ramenée dans ses limites, et les en-têtes cochés', () => {
    const [rows, columns, headerRow, headerColumn] = fields();
    set(rows, '12');
    set(columns, '99');
    headerRow.click();
    headerColumn.click();
    fixture.detectChanges();

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(picked).toEqual([{ rows: 12, columns: 20, hasHeaderRow: false, hasHeaderColumn: true }]);
  });

  it('propose une grille à cocher, par les noms de ses lignes et de ses colonnes', () => {
    const grids: GridShape[] = [];
    fixture.componentInstance.gridPicked.subscribe((shape) => grids.push(shape));
    const mode = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Grille à cocher',
    );
    mode?.click();
    fixture.detectChanges();
    const insert = host.querySelector<HTMLButtonElement>('.button-primary');
    expect(insert?.disabled).toBe(true);

    const [rows, columns] = fields();
    rows.value = 'P1, P2';
    rows.dispatchEvent(new Event('input'));
    columns.value = '0-2';
    columns.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(insert?.textContent.trim()).toBe('Insérer 2 × 3');
    insert?.click();

    expect(grids).toEqual([{ rowLabels: ['P1', 'P2'], columnLabels: ['0', '1', '2'] }]);
    expect(picked).toEqual([]);
  });

  it('se ferme avec Échap ou par un clic en dehors', () => {
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(closed).toBe(2);
  });
});
