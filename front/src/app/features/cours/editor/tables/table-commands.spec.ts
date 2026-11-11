import { Editor } from '@tiptap/core';
import { ContentNode } from '../../content/content-node';
import { createCourseExtensions } from '../../content/course-extensions';
import {
  canMoveCurrent,
  moveCurrent,
  moveInTable,
  tableLocation,
  targetIndex,
} from './table-commands';

function cell(text: string, type = 'tableCell'): ContentNode {
  return { type, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

function row(...cells: ContentNode[]): ContentNode {
  return { type: 'tableRow', content: cells };
}

describe('commandes de tableau', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'avant' }] },
          {
            type: 'table',
            content: [
              row(cell('A', 'tableHeader'), cell('B', 'tableHeader'), cell('C', 'tableHeader')),
              row(cell('a1'), cell('b1'), cell('c1')),
              row(cell('a2'), cell('b2'), cell('c2')),
            ],
          },
        ],
      },
    });
  });

  afterEach(() => editor.destroy());

  // Texte des cellules, ligne par ligne.
  function grid(): string[] {
    const rows: string[] = [];
    editor.state.doc.child(1).forEach((tableRow) => {
      const cells: string[] = [];
      tableRow.forEach((tableCell) => cells.push(tableCell.textContent));
      rows.push(cells.join(' '));
    });
    return rows;
  }

  // Place le curseur dans la cellule qui contient ce texte.
  function putCursorIn(text: string): void {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === text) {
        found = pos;
      }
    });
    editor.commands.setTextSelection(found);
  }

  const tablePos = (): number => editor.state.doc.child(0).nodeSize;

  it('situe le curseur dans le tableau', () => {
    putCursorIn('b2');

    expect(tableLocation(editor.state)).toEqual({
      tablePos: tablePos(),
      row: 2,
      column: 1,
      rowCount: 3,
      columnCount: 3,
    });
  });

  it('ne situe rien hors d’un tableau', () => {
    editor.commands.setTextSelection(2);

    expect(tableLocation(editor.state)).toBeNull();
    expect(moveCurrent(editor, 'row', 1)).toBe(false);
  });

  it('déplace une colonne à un autre rang', () => {
    expect(moveInTable(editor, tablePos(), 'column', 0, 2)).toBe(true);
    expect(grid()).toEqual(['B C A', 'b1 c1 a1', 'b2 c2 a2']);

    expect(moveInTable(editor, tablePos(), 'column', 2, 1)).toBe(true);
    expect(grid()).toEqual(['B A C', 'b1 a1 c1', 'b2 a2 c2']);
  });

  it('déplace une ligne à un autre rang', () => {
    expect(moveInTable(editor, tablePos(), 'row', 2, 1)).toBe(true);

    expect(grid()).toEqual(['A B C', 'a2 b2 c2', 'a1 b1 c1']);
  });

  it('refuse un rang hors du tableau ou inchangé', () => {
    expect(moveInTable(editor, tablePos(), 'column', 1, 1)).toBe(false);
    expect(moveInTable(editor, tablePos(), 'column', 1, 3)).toBe(false);
    expect(moveInTable(editor, tablePos(), 'row', -1, 0)).toBe(false);
    expect(moveInTable(editor, 0, 'row', 0, 1)).toBe(false);
    expect(grid()).toEqual(['A B C', 'a1 b1 c1', 'a2 b2 c2']);
  });

  it('déplace d’un cran la ligne ou la colonne du curseur', () => {
    putCursorIn('b1');

    expect(moveCurrent(editor, 'column', -1)).toBe(true);
    expect(moveCurrent(editor, 'row', 1)).toBe(true);

    expect(grid()).toEqual(['B A C', 'b2 a2 c2', 'b1 a1 c1']);
  });

  it('sait quand un déplacement d’un cran est possible', () => {
    putCursorIn('a2');

    expect(canMoveCurrent(editor.state, 'column', -1)).toBe(false);
    expect(canMoveCurrent(editor.state, 'column', 1)).toBe(true);
    expect(canMoveCurrent(editor.state, 'row', 1)).toBe(false);
    expect(canMoveCurrent(editor.state, 'row', -1)).toBe(true);
  });

  it('calcule le rang d’arrivée d’un dépôt sur une frontière', () => {
    expect(targetIndex(0, 3)).toBe(2);
    expect(targetIndex(2, 0)).toBe(0);
    expect(targetIndex(1, 1)).toBeNull();
    expect(targetIndex(1, 2)).toBeNull();
    expect(targetIndex(1, 3)).toBe(2);
  });
});
