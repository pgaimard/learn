import { Editor } from '@tiptap/core';
import { insertCheckGrid, parseColumns, parseLabels, toggleCheckAt } from './check-grid';
import { createCourseExtensions } from './course-extensions';

describe('grille à cocher', () => {
  let editor: Editor | null = null;
  let host: HTMLElement | null = null;

  function setup(): { editor: Editor; host: HTMLElement } {
    const element = document.createElement('div');
    document.body.append(element);
    const created = new Editor({
      element,
      extensions: createCourseExtensions(),
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    insertCheckGrid(created, { rowLabels: ['P1', 'P2'], columnLabels: ['0', '1', '2'] });
    editor = created;
    host = element;
    return { editor: created, host: element };
  }

  afterEach(() => {
    editor?.destroy();
    host?.remove();
    editor = null;
    host = null;
  });

  // Position de la case (ligne, colonne) du corps de la grille.
  function boxPos(editor: Editor, row: number, column: number): number {
    const positions: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell') {
        positions.push(pos);
      }
    });
    return positions[row * 3 + column];
  }

  function checked(editor: Editor): boolean[] {
    const found: boolean[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableCell') {
        found.push(node.attrs['checked'] === true);
      }
    });
    return found;
  }

  it('lit des libellés séparés par des virgules, ou une plage de nombres', () => {
    expect(parseLabels(' P1, P2 ,,P3 ', 50)).toEqual(['P1', 'P2', 'P3']);
    expect(parseColumns('0-3')).toEqual(['0', '1', '2', '3']);
    expect(parseColumns('1 à 3')).toEqual(['1', '2', '3']);
    expect(parseColumns('A, B')).toEqual(['A', 'B']);
    expect(parseColumns('0-500')).toHaveLength(60);
    expect(parseColumns('5-2')).toEqual([]);
  });

  it('insère une grille : en-têtes en première ligne et première colonne, cases ailleurs', () => {
    const { editor, host } = setup();

    const table = host.querySelector('table');
    const rows = Array.from(table?.rows ?? []).map((row) =>
      Array.from(row.cells)
        .map((cell) => `${cell.tagName}:${cell.textContent}`)
        .join(' '),
    );
    expect(rows).toEqual(['TH: TH:0 TH:1 TH:2', 'TH:P1 TD: TD: TD:', 'TH:P2 TD: TD: TD:']);
    expect(host.querySelector('.check-grid')).not.toBeNull();
    expect(checked(editor)).toEqual(Array(6).fill(false));
  });

  it('remplit puis vide la case cliquée, et la marque d’une classe', () => {
    const { editor, host } = setup();

    const fill = toggleCheckAt(editor.state, boxPos(editor, 1, 2) + 1);
    if (fill) {
      editor.view.dispatch(fill);
    }

    expect(checked(editor)).toEqual([false, false, false, false, false, true]);
    expect(host.querySelectorAll('td.is-checked')).toHaveLength(1);

    const empty = toggleCheckAt(editor.state, boxPos(editor, 1, 2) + 1);
    if (empty) {
      editor.view.dispatch(empty);
    }

    expect(checked(editor)).toEqual(Array(6).fill(false));
  });

  it('ne coche ni un en-tête de la grille, ni la cellule d’un tableau ordinaire', () => {
    const { editor, host } = setup();
    let headerPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (headerPos < 0 && node.type.name === 'tableHeader') {
        headerPos = pos;
      }
    });
    expect(toggleCheckAt(editor.state, headerPos + 1)).toBeNull();

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }],
            },
          ],
        },
      ],
    });

    expect(toggleCheckAt(editor.state, 3)).toBeNull();
    expect(host.querySelector('.check-grid')).toBeNull();
  });
});
