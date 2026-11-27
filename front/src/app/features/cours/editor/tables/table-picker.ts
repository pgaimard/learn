import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  GridShape,
  MAX_GRID_COLUMNS,
  MAX_GRID_ROWS,
  parseColumns,
  parseLabels,
} from '../../content/check-grid';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, TableShape } from './table-commands';

const GRID_ROWS = 8;
const GRID_COLUMNS = 10;

function range(count: number): number[] {
  return Array.from({ length: count }, (_unused, index) => index + 1);
}

function clamp(value: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), max) : 1;
}

// Choix d'un tableau à insérer : sa taille, prise d'un geste sur la grille ou saisie, et
// ses en-têtes ; ou une grille à cocher, par les noms de ses lignes et de ses colonnes.
@Component({
  selector: 'app-table-picker',
  templateUrl: './table-picker.html',
  styleUrl: './table-picker.css',
  host: {
    role: 'dialog',
    'aria-label': 'Insérer un tableau',
    '(keydown.escape)': 'closed.emit()',
    '(keydown.enter)': 'choose($event)',
    '(document:mousedown)': 'closeIfOutside($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePicker {
  readonly picked = output<TableShape>();
  readonly gridPicked = output<GridShape>();
  readonly closed = output();

  protected readonly gridRows = range(GRID_ROWS);
  protected readonly gridColumns = range(GRID_COLUMNS);
  protected readonly maxRows = MAX_TABLE_ROWS;
  protected readonly maxColumns = MAX_TABLE_COLUMNS;

  protected readonly maxGridRows = MAX_GRID_ROWS;
  protected readonly maxGridColumns = MAX_GRID_COLUMNS;

  // Tableau ordinaire, ou grille à cocher.
  protected readonly isGrid = signal(false);
  protected readonly rowLabels = signal<string[]>([]);
  protected readonly columnLabels = signal<string[]>([]);
  protected readonly canInsertGrid = computed(
    () => this.rowLabels().length > 0 && this.columnLabels().length > 0,
  );

  protected readonly rows = signal(3);
  protected readonly columns = signal(3);
  protected readonly hasHeaderRow = signal(true);
  protected readonly hasHeaderColumn = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rowsField = viewChild.required<ElementRef<HTMLInputElement>>('rowsField');

  constructor() {
    afterNextRender(() => this.rowsField().nativeElement.select());
  }

  protected aim(rows: number, columns: number): void {
    this.rows.set(rows);
    this.columns.set(columns);
  }

  protected setRows(value: string): void {
    this.rows.set(clamp(Number(value), MAX_TABLE_ROWS));
  }

  protected setColumns(value: string): void {
    this.columns.set(clamp(Number(value), MAX_TABLE_COLUMNS));
  }

  protected setRowLabels(value: string): void {
    this.rowLabels.set(parseLabels(value, MAX_GRID_ROWS));
  }

  protected setColumnLabels(value: string): void {
    this.columnLabels.set(parseColumns(value));
  }

  protected choose(event?: Event): void {
    event?.preventDefault();
    if (this.isGrid()) {
      if (this.canInsertGrid()) {
        this.gridPicked.emit({ rowLabels: this.rowLabels(), columnLabels: this.columnLabels() });
      }
      return;
    }
    this.picked.emit({
      rows: this.rows(),
      columns: this.columns(),
      hasHeaderRow: this.hasHeaderRow(),
      hasHeaderColumn: this.hasHeaderColumn(),
    });
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closed.emit();
    }
  }
}
