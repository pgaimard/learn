import { ContentNode } from './content-node.js';
import {
  inlineToMarkdown,
  plainText,
  ReportLoss,
} from './inline-to-markdown.js';

const DELIMITERS: Record<string, string> = {
  left: ':---',
  center: ':---:',
  right: '---:',
};

function cellsOf(row: ContentNode | undefined): ContentNode[] {
  return row?.content ?? [];
}

function alignOf(cell: ContentNode | undefined): string | null {
  const align = cell?.attrs?.['align'];
  return typeof align === 'string' ? align : null;
}

// Une cellule tient sur une ligne : un seul paragraphe s'y écrit sans perte.
function cellText(cell: ContentNode, report: ReportLoss): string {
  const blocks = (cell.content ?? []).filter(
    (block) => block.type !== 'paragraph' || (block.content ?? []).length > 0,
  );
  if (blocks.length > 1 || blocks.some((block) => block.type !== 'paragraph')) {
    report('cellule de tableau qui contient plus d’un paragraphe');
  }
  return blocks
    .map((block) =>
      block.type === 'paragraph'
        ? inlineToMarkdown(block.content ?? [], report, false)
        : plainText(block),
    )
    .join(' ')
    .replace(/\|/g, '\\|');
}

function checkCell(
  cell: ContentNode,
  columnAlign: string | null,
  report: ReportLoss,
): void {
  const attrs = cell.attrs ?? {};
  if ((attrs['colspan'] ?? 1) !== 1 || (attrs['rowspan'] ?? 1) !== 1) {
    report('cellules fusionnées');
  }
  if ((attrs['colwidth'] ?? null) !== null) {
    report('largeurs de colonnes');
  }
  if ((attrs['verticalAlign'] ?? null) !== null) {
    report('alignement vertical dans un tableau');
  }
  if (alignOf(cell) !== columnAlign) {
    report('alignement propre à une cellule de tableau');
  }
}

// Le Markdown ne connaît qu'une ligne d'en-tête, la première ; une grille à cocher y
// ajoute sa première colonne.
function checkHeaders(
  rows: ContentNode[],
  grid: boolean,
  report: ReportLoss,
): void {
  if (cellsOf(rows[0]).some((cell) => cell.type !== 'tableHeader')) {
    report('tableau sans ligne d’en-tête');
  }
  const body = rows.slice(1).flatMap((row) => cellsOf(row).slice(grid ? 1 : 0));
  if (body.some((cell) => cell.type === 'tableHeader')) {
    report(
      'cellules d’en-tête ailleurs que sur la première ligne d’un tableau',
    );
  }
}

function line(cells: string[], width: number): string {
  const padded = [...cells, ...Array<string>(width - cells.length).fill('')];
  return `| ${padded.join(' | ')} |`;
}

export function tableToMarkdown(
  table: ContentNode,
  report: ReportLoss,
): string[] {
  const rows = table.content ?? [];
  const grid = table.attrs?.['grid'] === true;
  const width = Math.max(1, ...rows.map((row) => cellsOf(row).length));
  const aligns = cellsOf(rows[0]).map(alignOf);
  checkHeaders(rows, grid, report);
  const lines = rows.map((row, rowIndex) =>
    line(
      cellsOf(row).map((cell, column) => {
        checkCell(cell, aligns[column] ?? null, report);
        if (grid && rowIndex > 0 && column > 0) {
          return cell.attrs?.['checked'] === true ? '[x]' : '[ ]';
        }
        return cellText(cell, report);
      }),
      width,
    ),
  );
  const delimiter = Array.from(
    { length: width },
    (_, column) => DELIMITERS[aligns[column] ?? ''] ?? '---',
  );
  return [
    lines[0] ?? line([], width),
    line(delimiter, width),
    ...lines.slice(1),
  ];
}
