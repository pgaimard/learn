import { Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { cellAround, findTable, TableMap } from '@tiptap/pm/tables';
import { EditorView } from '@tiptap/pm/view';
import { moveInTable, TableAxis, targetIndex } from './table-commands';

export interface TableToolsOptions {
  // Clic droit dans une cellule : ouvre le menu du tableau à cet endroit
  // (en pixels depuis le coin haut gauche de la zone de contenu).
  onOpenMenu: (target: { top: number; left: number }) => void;
}

// Cellule survolée, située dans son tableau.
interface HoveredCell {
  tablePos: number;
  row: number;
  column: number;
  cell: HTMLElement;
  table: HTMLElement;
}

// Ligne ou colonne en cours de déplacement par sa poignée, partagée avec le dépôt.
interface TableDrag {
  active: { tablePos: number; axis: TableAxis; from: number } | null;
}

const HIDE_DELAY_MS = 300;
const GRIP_LABELS: Record<TableAxis, string> = {
  row: 'Faire glisser pour déplacer la ligne',
  column: 'Faire glisser pour déplacer la colonne',
};

function locateCell(view: EditorView, target: EventTarget | null): HoveredCell | null {
  const cell = target instanceof Element ? target.closest<HTMLElement>('td, th') : null;
  const table = cell?.closest<HTMLElement>('table');
  if (!cell || !table || !view.dom.contains(cell)) {
    return null;
  }
  const $cell = cellAround(view.state.doc.resolve(view.posAtDOM(cell, 0)));
  const found = $cell ? findTable($cell) : null;
  if (!$cell || !found) {
    return null;
  }
  const rect = TableMap.get(found.node).findCell($cell.pos - found.start);
  return { tablePos: found.pos, row: rect.top, column: rect.left, cell, table };
}

// Bords des lignes ou des colonnes du tableau, en coordonnées de la fenêtre : n + 1 valeurs.
function boundaries(view: EditorView, tablePos: number, axis: TableAxis): number[] {
  const table = view.state.doc.nodeAt(tablePos);
  if (table?.type.name !== 'table') {
    return [];
  }
  const map = TableMap.get(table);
  const count = axis === 'row' ? map.height : map.width;
  const edges: number[] = [];
  let last = 0;
  for (let index = 0; index < count; index++) {
    const offset = axis === 'row' ? map.map[index * map.width] : map.map[index];
    const element = view.nodeDOM(tablePos + 1 + offset);
    if (!(element instanceof HTMLElement)) {
      return [];
    }
    const box = element.getBoundingClientRect();
    edges.push(axis === 'row' ? box.top : box.left);
    last = axis === 'row' ? box.bottom : box.right;
  }
  return [...edges, last];
}

function nearestBoundary(edges: number[], coordinate: number): number {
  let nearest = 0;
  edges.forEach((edge, index) => {
    if (Math.abs(edge - coordinate) < Math.abs(edges[nearest] - coordinate)) {
      nearest = index;
    }
  });
  return nearest;
}

// Poignées de la ligne et de la colonne de la cellule survolée, et trait de dépôt.
class TableGripsView {
  private readonly container: HTMLElement;
  private readonly grips: Record<TableAxis, HTMLButtonElement>;
  private readonly indicator: HTMLElement;
  private hovered: HoveredCell | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly drag: TableDrag,
  ) {
    this.container = view.dom.parentElement ?? view.dom;
    this.grips = { row: this.createGrip('row'), column: this.createGrip('column') };
    this.indicator = document.createElement('div');
    this.indicator.className = 'table-drop-indicator';
    this.indicator.hidden = true;
    this.container.append(this.grips.row, this.grips.column, this.indicator);
    this.container.addEventListener('mousemove', this.onMouseMove);
    this.container.addEventListener('mouseleave', this.onMouseLeave);
  }

  update(): void {
    // Le tableau a pu changer sous les poignées : elles réapparaîtront au prochain survol.
    if (!this.drag.active) {
      this.show(null);
    }
  }

  destroy(): void {
    this.container.removeEventListener('mousemove', this.onMouseMove);
    this.container.removeEventListener('mouseleave', this.onMouseLeave);
    this.cancelHide();
    this.grips.row.remove();
    this.grips.column.remove();
    this.indicator.remove();
  }

  // Trait à l'endroit où la ligne ou la colonne serait déposée.
  showIndicator(axis: TableAxis, tablePos: number, boundary: number): void {
    const edges = boundaries(this.view, tablePos, axis);
    const table = this.view.nodeDOM(tablePos);
    const box = table instanceof HTMLElement ? table.querySelector('table') : null;
    if (edges.length === 0 || !box) {
      this.indicator.hidden = true;
      return;
    }
    const origin = this.container.getBoundingClientRect();
    const frame = box.getBoundingClientRect();
    const style = this.indicator.style;
    if (axis === 'column') {
      style.left = `${edges[boundary] - origin.left - 1}px`;
      style.top = `${frame.top - origin.top}px`;
      style.width = '3px';
      style.height = `${frame.height}px`;
    } else {
      style.left = `${frame.left - origin.left}px`;
      style.top = `${edges[boundary] - origin.top - 1}px`;
      style.width = `${frame.width}px`;
      style.height = '3px';
    }
    this.indicator.hidden = false;
  }

  hideIndicator(): void {
    this.indicator.hidden = true;
  }

  private createGrip(axis: TableAxis): HTMLButtonElement {
    const grip = document.createElement('button');
    grip.type = 'button';
    grip.className = `table-grip table-grip-${axis}`;
    grip.draggable = true;
    grip.hidden = true;
    grip.tabIndex = -1;
    grip.setAttribute('aria-label', GRIP_LABELS[axis]);
    grip.title = GRIP_LABELS[axis];
    grip.textContent = axis === 'row' ? '⋮' : '⋯';
    grip.addEventListener('mouseenter', () => this.cancelHide());
    grip.addEventListener('mouseleave', () => this.hideSoon());
    grip.addEventListener('dragstart', (event) => this.startDrag(event, axis));
    grip.addEventListener('dragend', () => this.endDrag());
    return grip;
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.drag.active || event.target === this.grips.row || event.target === this.grips.column) {
      this.cancelHide();
      return;
    }
    const cell = this.view.editable ? locateCell(this.view, event.target) : null;
    if (cell) {
      this.cancelHide();
      this.show(cell);
    } else {
      this.hideSoon();
    }
  };

  private readonly onMouseLeave = (): void => this.hideSoon();

  private show(cell: HoveredCell | null): void {
    this.hovered = cell;
    this.grips.row.hidden = cell === null;
    this.grips.column.hidden = cell === null;
    if (!cell) {
      return;
    }
    const origin = this.container.getBoundingClientRect();
    const frame = cell.table.getBoundingClientRect();
    const box = cell.cell.getBoundingClientRect();
    // À cheval sur le bord du tableau, au milieu de la ligne ou de la colonne survolée.
    this.grips.column.style.left = `${box.left - origin.left + box.width / 2}px`;
    this.grips.column.style.top = `${frame.top - origin.top}px`;
    this.grips.row.style.left = `${frame.left - origin.left}px`;
    this.grips.row.style.top = `${box.top - origin.top + box.height / 2}px`;
  }

  private hideSoon(): void {
    if (this.hideTimer === null && !this.drag.active) {
      this.hideTimer = setTimeout(() => {
        this.hideTimer = null;
        this.show(null);
      }, HIDE_DELAY_MS);
    }
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private startDrag(event: DragEvent, axis: TableAxis): void {
    const cell = this.hovered;
    if (!cell || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    this.drag.active = {
      tablePos: cell.tablePos,
      axis,
      from: axis === 'row' ? cell.row : cell.column,
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');
    this.container.classList.add('is-dragging-in-table');
  }

  private endDrag(): void {
    this.drag.active = null;
    this.hideIndicator();
    this.container.classList.remove('is-dragging-in-table');
  }
}

// Frontière visée par la souris pendant le déplacement d'une ligne ou d'une colonne.
function aimedBoundary(view: EditorView, drag: TableDrag, event: DragEvent): number | null {
  if (!drag.active) {
    return null;
  }
  const edges = boundaries(view, drag.active.tablePos, drag.active.axis);
  if (edges.length === 0) {
    return null;
  }
  return nearestBoundary(edges, drag.active.axis === 'row' ? event.clientY : event.clientX);
}

// Clic droit (ou touche de menu) dans une cellule : le curseur s'y place et le menu s'ouvre.
function openMenu(view: EditorView, event: MouseEvent, options: TableToolsOptions): boolean {
  if (!view.editable || !locateCell(view, event.target)) {
    return false;
  }
  event.preventDefault();
  const clicked = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const { selection } = view.state;
  // Une sélection qui contient déjà l'endroit cliqué (plusieurs cellules) est conservée.
  if (clicked && (clicked.pos < selection.from || clicked.pos > selection.to)) {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(clicked.pos))),
    );
  }
  // Menu ouvert au clavier : il n'y a pas de position de souris, on prend celle du curseur.
  const caret = view.coordsAtPos(view.state.selection.from);
  const fromKeyboard = event.clientX === 0 && event.clientY === 0;
  const origin = (view.dom.parentElement ?? view.dom).getBoundingClientRect();
  options.onOpenMenu({
    top: (fromKeyboard ? caret.bottom : event.clientY) - origin.top,
    left: (fromKeyboard ? caret.left : event.clientX) - origin.left,
  });
  return true;
}

function dropInTable(editor: Editor, view: EditorView, drag: TableDrag, event: DragEvent): boolean {
  const active = drag.active;
  if (!active) {
    return false;
  }
  const boundary = aimedBoundary(view, drag, event);
  const to = boundary === null ? null : targetIndex(active.from, boundary);
  drag.active = null;
  if (to !== null) {
    moveInTable(editor, active.tablePos, active.axis, active.from, to);
  }
  return true;
}

// Outils de tableau : menu au clic droit, poignées pour glisser une ligne ou une colonne.
export const TableTools = Extension.create<TableToolsOptions>({
  name: 'tableTools',
  // Avant l'indicateur de dépôt de l'éditeur : pendant le déplacement d'une ligne ou
  // d'une colonne, c'est notre trait qui s'affiche.
  priority: 1000,

  addOptions() {
    return { onOpenMenu: () => undefined };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor;
    const drag: TableDrag = { active: null };
    let grips: TableGripsView | null = null;
    return [
      new Plugin({
        key: new PluginKey('tableTools'),
        view: (view) => {
          grips = new TableGripsView(view, drag);
          return grips;
        },
        props: {
          handleDOMEvents: {
            contextmenu: (view, event) => openMenu(view, event, options),
            dragover: (view, event) => {
              const boundary = aimedBoundary(view, drag, event);
              if (!drag.active || boundary === null) {
                return false;
              }
              event.preventDefault();
              grips?.showIndicator(drag.active.axis, drag.active.tablePos, boundary);
              return true;
            },
          },
          handleDrop: (view, event) => {
            grips?.hideIndicator();
            return dropInTable(editor, view, drag, event);
          },
        },
      }),
    ];
  },
});
