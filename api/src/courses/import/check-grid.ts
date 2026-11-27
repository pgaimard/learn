import { ContentNode } from '../content/content-node.js';

// Case d'une grille à cocher : « [x] » pour une case remplie, « [ ] » pour une case vide.
const CHECK_BOX = /^\[( |x|X)\]$/;

function textOf(cell: ContentNode): string {
  return (cell.content ?? [])
    .flatMap((block) => block.content ?? [])
    .map((inline) => inline.text ?? '')
    .join('')
    .trim();
}

// Un tableau est une grille à cocher quand, sous sa ligne d'en-tête, chaque cellule après
// la première colonne est une case. Il lui faut au moins une ligne et une case.
function isCheckGrid(rows: ContentNode[]): boolean {
  const body = rows.slice(1);
  return (
    body.length > 0 &&
    body.every((row) => {
      const boxes = (row.content ?? []).slice(1);
      return (
        boxes.length > 0 && boxes.every((cell) => CHECK_BOX.test(textOf(cell)))
      );
    })
  );
}

function checkRow(row: ContentNode): ContentNode {
  const [label, ...boxes] = row.content ?? [];
  return {
    ...row,
    content: [
      // La première colonne nomme la ligne : c'est un en-tête.
      { ...label, type: 'tableHeader' },
      ...boxes.map((cell) => ({
        ...cell,
        attrs: {
          ...cell.attrs,
          checked: CHECK_BOX.exec(textOf(cell))?.[1] !== ' ',
        },
        content: [{ type: 'paragraph' }],
      })),
    ],
  };
}

// Tableau lu dans le Markdown : une grille à cocher s'il en a la forme, un tableau
// ordinaire sinon.
export function tableFromRows(rows: ContentNode[]): ContentNode {
  if (!isCheckGrid(rows)) {
    return { type: 'table', content: rows };
  }
  return {
    type: 'table',
    attrs: { grid: true },
    content: [rows[0], ...rows.slice(1).map(checkRow)],
  };
}
