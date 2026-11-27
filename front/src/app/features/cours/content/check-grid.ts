import { Editor, Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey, Transaction } from '@tiptap/pm/state';
import { cellAround, findTable } from '@tiptap/pm/tables';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ContentNode } from './content-node';

// Grille à cocher : un tableau dont la première ligne et la première colonne nomment les
// colonnes et les lignes, et dont les autres cellules sont des cases, remplies ou vides.
// Elle sert aux chronogrammes (un processus par ligne, une unité de temps par colonne).
export interface GridShape {
  rowLabels: string[];
  columnLabels: string[];
}

export const MAX_GRID_ROWS = 50;
export const MAX_GRID_COLUMNS = 60;

const RANGE = /^\s*(\d{1,4})\s*(?:-|–|à)\s*(\d{1,4})\s*$/;

// Libellés saisis, séparés par des virgules ; les vides sont ignorés.
export function parseLabels(text: string, max: number): string[] {
  return text
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .slice(0, max);
}

// Colonnes saisies : une plage de nombres (« 0-30 », « 1 à 12 ») ou des libellés.
export function parseColumns(text: string): string[] {
  const range = RANGE.exec(text);
  if (!range) {
    return parseLabels(text, MAX_GRID_COLUMNS);
  }
  const from = Number(range[1]);
  const count = Math.min(Math.max(Number(range[2]) - from + 1, 0), MAX_GRID_COLUMNS);
  return Array.from({ length: count }, (_unused, index) => String(from + index));
}

function cell(type: 'tableHeader' | 'tableCell', label = ''): ContentNode {
  const paragraph: ContentNode = label
    ? { type: 'paragraph', content: [{ type: 'text', text: label }] }
    : { type: 'paragraph' };
  return { type, content: [paragraph] };
}

// Insère une grille vide à l'endroit du curseur.
export function insertCheckGrid(editor: Editor, shape: GridShape): boolean {
  const header = {
    type: 'tableRow',
    content: [
      cell('tableHeader'),
      ...shape.columnLabels.map((label) => cell('tableHeader', label)),
    ],
  };
  const rows = shape.rowLabels.map((label) => ({
    type: 'tableRow',
    content: [cell('tableHeader', label), ...shape.columnLabels.map(() => cell('tableCell'))],
  }));
  return editor
    .chain()
    .focus()
    .insertContent({ type: 'table', attrs: { grid: true }, content: [header, ...rows] })
    .run();
}

// Remplit ou vide la case placée à cette position ; null si ce n'est pas la case d'une grille.
export function toggleCheckAt(state: EditorState, pos: number): Transaction | null {
  const $cell = cellAround(state.doc.resolve(pos));
  const box = $cell?.nodeAfter;
  const table = $cell ? findTable($cell) : null;
  if (!$cell || !box || box.type.name !== 'tableCell' || table?.node.attrs['grid'] !== true) {
    return null;
  }
  return state.tr.setNodeMarkup($cell.pos, null, {
    ...box.attrs,
    checked: box.attrs['checked'] !== true,
  });
}

// Marque les grilles d'une classe : la feuille de style en fait des cases.
function gridDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'table') {
      return true;
    }
    if (node.attrs['grid'] === true) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'check-grid' }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

export const CheckGrid = Extension.create({
  name: 'checkGrid',

  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          grid: {
            default: false,
            parseHTML: (element) => element.hasAttribute('data-grid'),
            renderHTML: (attributes) => (attributes['grid'] === true ? { 'data-grid': '' } : {}),
          },
        },
      },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          checked: {
            default: false,
            parseHTML: (element) => element.classList.contains('is-checked'),
            renderHTML: (attributes) =>
              attributes['checked'] === true ? { class: 'is-checked' } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('checkGrid'),
        props: {
          decorations: (state) => gridDecorations(state.doc),
          // En édition, un clic sur une case la remplit ou la vide.
          handleClick: (view, pos) => {
            const transaction = view.editable ? toggleCheckAt(view.state, pos) : null;
            if (transaction) {
              view.dispatch(transaction);
            }
            return transaction !== null;
          },
        },
      }),
    ];
  },
});
