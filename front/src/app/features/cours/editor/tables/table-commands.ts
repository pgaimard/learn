import { Editor } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import {
  findTable,
  isInTable,
  moveTableColumn,
  moveTableRow,
  selectedRect,
  TableMap,
} from '@tiptap/pm/tables';

// Cellule du curseur dans son tableau.
export interface TableLocation {
  // Position du tableau dans le document.
  tablePos: number;
  row: number;
  column: number;
  rowCount: number;
  columnCount: number;
}

export type TableAxis = 'row' | 'column';

export function tableLocation(state: EditorState): TableLocation | null {
  if (!isInTable(state)) {
    return null;
  }
  const rect = selectedRect(state);
  return {
    tablePos: rect.tableStart - 1,
    row: rect.top,
    column: rect.left,
    rowCount: rect.map.height,
    columnCount: rect.map.width,
  };
}

// Nombre de lignes ou de colonnes du tableau situé à tablePos.
export function tableSize(state: EditorState, tablePos: number, axis: TableAxis): number {
  const table = state.doc.nodeAt(tablePos);
  if (table?.type.name !== 'table') {
    return 0;
  }
  const map = TableMap.get(table);
  return axis === 'row' ? map.height : map.width;
}

// Déplace la ligne ou la colonne de rang « from » au rang « to » dans le tableau situé à
// tablePos. Renvoie false si le déplacement n'a pas de sens ou est refusé (cellules fusionnées).
export function moveInTable(
  editor: Editor,
  tablePos: number,
  axis: TableAxis,
  from: number,
  to: number,
): boolean {
  const size = tableSize(editor.state, tablePos, axis);
  if (from === to || from < 0 || to < 0 || from >= size || to >= size) {
    return false;
  }
  // La bibliothèque retrouve le tableau par la sélection : on y place le curseur d'abord.
  if (tablePosAt(editor.state, editor.state.selection.from) !== tablePos) {
    placeCursor(editor, tablePos, 0, 0);
  }
  const options = { from, to, select: true };
  const command = axis === 'row' ? moveTableRow(options) : moveTableColumn(options);
  return command(editor.state, editor.view.dispatch);
}

// Déplace la ligne ou la colonne du curseur d'un cran : -1 vers le haut ou la gauche,
// 1 vers le bas ou la droite. Le curseur reste dans la même cellule, qui a bougé avec elle.
export function moveCurrent(editor: Editor, axis: TableAxis, step: -1 | 1): boolean {
  const location = tableLocation(editor.state);
  if (!location) {
    return false;
  }
  const from = axis === 'row' ? location.row : location.column;
  if (!moveInTable(editor, location.tablePos, axis, from, from + step)) {
    return false;
  }
  placeCursor(
    editor,
    location.tablePos,
    axis === 'row' ? from + step : location.row,
    axis === 'column' ? from + step : location.column,
  );
  return true;
}

// Place le curseur dans la cellule (row, column) du tableau situé à tablePos.
function placeCursor(editor: Editor, tablePos: number, row: number, column: number): void {
  const table = editor.state.doc.nodeAt(tablePos);
  if (table?.type.name !== 'table') {
    return;
  }
  const cellPos = tablePos + 1 + TableMap.get(table).positionAt(row, column, table);
  const selection = TextSelection.near(editor.state.doc.resolve(cellPos + 1));
  editor.view.dispatch(editor.state.tr.setSelection(selection));
}

export function canMoveCurrent(state: EditorState, axis: TableAxis, step: -1 | 1): boolean {
  const location = tableLocation(state);
  if (!location) {
    return false;
  }
  const from = axis === 'row' ? location.row : location.column;
  const size = axis === 'row' ? location.rowCount : location.columnCount;
  return from + step >= 0 && from + step < size;
}

// Rang d'arrivée d'une ligne ou d'une colonne déposée sur la frontière « boundary »
// (0 avant la première, n après la dernière) ; null si elle ne bouge pas.
export function targetIndex(from: number, boundary: number): number | null {
  const to = boundary > from ? boundary - 1 : boundary;
  return to === from ? null : to;
}

// Position du tableau qui contient la position donnée ; null hors d'un tableau.
export function tablePosAt(state: EditorState, pos: number): number | null {
  return findTable(state.doc.resolve(pos))?.pos ?? null;
}
