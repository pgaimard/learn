import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateContent } from '../content/validate-content.js';
import { markdownToContent } from './markdown-to-content.js';

const GRID = [
  '| Processus | 0 | 1 | 2 |',
  '|-----------|---|---|---|',
  '| P1        | [x] | [x] | [ ] |',
  '| P2        | [ ] | [ ] | [X] |',
].join('\n');

describe('grille à cocher dans le Markdown', () => {
  it('fait une grille d’un tableau dont le corps n’est fait que de cases', () => {
    const { document, errors } = markdownToContent(GRID, 0);

    expect(errors).toEqual([]);
    expect(validateContent(document)).toEqual([]);
    const table = document.content?.[0];
    expect(table?.attrs).toEqual({ grid: true });
    const [header, first, second] = table?.content ?? [];
    expect(header.content?.map((cell) => cell.type)).toEqual(
      Array(4).fill('tableHeader'),
    );
    expect(first.content?.map((cell) => cell.type)).toEqual([
      'tableHeader',
      'tableCell',
      'tableCell',
      'tableCell',
    ]);
    expect(
      first.content?.slice(1).map((cell) => cell.attrs?.['checked']),
    ).toEqual([true, true, false]);
    expect(
      second.content?.slice(1).map((cell) => cell.attrs?.['checked']),
    ).toEqual([false, false, true]);
    // La case ne garde pas son « [x] » en texte.
    expect(first.content?.[1].content).toEqual([{ type: 'paragraph' }]);
  });

  it('laisse en tableau ordinaire celui qui a une cellule de texte dans son corps', () => {
    const { document } = markdownToContent(
      GRID.replace('| [x] | [ ] |', '| oui | [ ] |'),
      0,
    );

    const table = document.content?.[0];
    expect(table?.attrs).toBeUndefined();
    expect(table?.content?.[1].content?.[0].type).toBe('tableCell');
  });

  it('laisse en tableau ordinaire celui qui n’a qu’une colonne ou qu’une ligne d’en-tête', () => {
    const single = markdownToContent('| a |\n|---|\n| [x] |', 0).document;
    const headerOnly = markdownToContent('| a | b |\n|---|---|', 0).document;

    expect(single.content?.[0].attrs).toBeUndefined();
    expect(headerOnly.content?.[0].attrs).toBeUndefined();
  });

  it('lit l’exemple de grille du contrat du paquet', () => {
    const readme = readFileSync(
      join(import.meta.dirname, '../../../../contracts/README.md'),
      'utf8',
    );
    const example =
      /```markdown\n(\| Processus \|[\s\S]*?)```/.exec(readme)?.[1] ?? '';

    const { document, errors } = markdownToContent(example, 0);

    expect(errors).toEqual([]);
    expect(document.content?.[0].attrs).toEqual({ grid: true });
    expect(document.content?.[0].content).toHaveLength(4);
  });
});
