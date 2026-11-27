import { readFileSync } from 'node:fs';
import { markdownToContent } from '../import/markdown-to-content.js';
import { parseFrontMatter } from '../import/parse-front-matter.js';
import { ContentMark, ContentNode } from './content-node.js';
import { contentToMarkdown } from './content-to-markdown.js';

function contract(name: string): string {
  return readFileSync(
    new URL(`../../../../contracts/${name}`, import.meta.url),
    'utf8',
  );
}

// Relit le Markdown écrit, comme le ferait une réécriture du contenu.
function reread(document: ContentNode): ContentNode {
  const { markdown } = contentToMarkdown(document);
  const converted = markdownToContent(markdown);
  expect(converted.errors).toEqual([]);
  return converted.document;
}

function text(value: string, ...marks: string[]): ContentNode {
  return marks.length > 0
    ? { type: 'text', text: value, marks: marks.map((type) => ({ type })) }
    : { type: 'text', text: value };
}

function paragraph(...content: ContentNode[]): ContentNode {
  return { type: 'paragraph', content };
}

function doc(...content: ContentNode[]): ContentNode {
  return { type: 'doc', content };
}

const RICH = `## 1. Processus

Un **processus** est un *programme* en ~~attente~~ exécution, voir \`fork()\` et la
[documentation](https://www.cnam.fr "CNAM"), puis ***les deux* seulement gras**.

Première ligne\\
seconde ligne.

- Prêt
  - sous-liste
  - encore
- Élu

* Autre liste

3. Trois
4. Quatre

- Un élément long.

  Son second paragraphe.

  \`\`\`sh
  ls -l
  \`\`\`

- Le suivant.

> Citation simple.
>
> > Citation dans la citation.

> [!attention]
>
> - Premier point
> - Second point

> [!definition]
> Un **processus** a son propre espace d'adressage.
>
> | A | B |
> |---|---|
> | 1 | 2 |

\`\`\`\`markdown
\`\`\`c
int main(void) { return 0; }
\`\`\`
\`\`\`\`

| Algorithme | Préemptif | Note |
|:-----------|----------:|:----:|
| FIFO       | Non       | a \\| b |

| Processus | 0   | 1   |
|-----------|-----|-----|
| P1        | [x] | [ ] |

---

#### 1.1.1 Détail

Code avec accent grave : \`\` a\`b \`\`.
`;

describe('contentToMarkdown', () => {
  it.each([
    ['cours.example.md'],
    ['fiche.example.md'],
    ['exercices.example.md'],
  ])('écrit %s de sorte qu’il se relise à l’identique', (name) => {
    const { body } = parseFrontMatter(contract(name));
    const source = markdownToContent(
      name === 'cours.example.md' ? body : contract(name),
    );

    const written = contentToMarkdown(source.document);

    expect(source.errors).toEqual([]);
    expect(written.losses).toEqual([]);
    expect(reread(source.document)).toEqual(source.document);
  });

  it('relit à l’identique listes imbriquées, citations, encadrés, code, tableaux et grilles', () => {
    const source = markdownToContent(RICH);

    expect(source.errors).toEqual([]);
    expect(contentToMarkdown(source.document).losses).toEqual([]);
    expect(reread(source.document)).toEqual(source.document);
  });

  it('écrit le Markdown du contrat', () => {
    const { markdown } = contentToMarkdown(
      markdownToContent(contract('exercices.example.md')).document,
    );

    expect(markdown).toContain(
      '> [!qcm] Autour des processus\n>\n> 1. Un processus est :\n>    - [x] la dynamique',
    );
    expect(markdown).toContain(
      '> [!exercice] Exercice 1 : ordonnancement\n>\n> On considère',
    );
    expect(markdown).toContain('> > [!corrige]\n> > **La méthode.** Dresser');
    expect(markdown).toContain(
      '> > | P1 | [x] | [x] | [x] | [ ] | [ ] | [ ] |',
    );
  });

  it('neutralise ce que le Markdown prendrait pour une mise en forme', () => {
    const document = doc(
      paragraph(
        text(
          '2 * 3 = 6, a_b et _c_, [lien](x), `code`, <b>, &amp; ~~non~~ \\ fin',
        ),
      ),
      paragraph(text('# pas un titre')),
      paragraph(text('> pas une citation')),
      paragraph(text('- pas une liste')),
      paragraph(text('1. pas une liste')),
      paragraph(text('---')),
      paragraph(
        text('[!retenir] pas un encadré'),
        { type: 'hardBreak' },
        text('=== pas un titre'),
      ),
      { type: 'heading', attrs: { level: 2 }, content: [text('C #')] },
    );

    expect(reread(document)).toEqual(document);
  });

  it('laisse tels quels un titre numéroté et le début d’une cellule ou d’un choix', () => {
    const markdown =
      '## 1. Processus\n\n| N° | Rôle |\n| --- | --- |\n| 1. | - |\n\n' +
      '> [!qcm]\n>\n> 1. Question\n>    - [x] 1. oui\n>    - [ ] - non\n';

    expect(
      contentToMarkdown(markdownToContent(markdown).document).markdown,
    ).toBe(markdown);
  });

  it('place les marques contre le texte, espaces dehors', () => {
    const document = doc(
      paragraph(
        text('Un '),
        text('mot gras ', 'bold'),
        text('puis les deux', 'bold', 'italic'),
        text(' et ', 'italic'),
        text('barré', 'strike'),
        text('.'),
      ),
    );

    expect(contentToMarkdown(document).markdown).toBe(
      'Un **mot gras *puis les deux*** *et* ~~barré~~.\n',
    );
  });

  it('n’écrit ni paragraphe vide, ni corrigé vide, ni explication vide', () => {
    const source = markdownToContent(
      '> [!exercice] Sans corrigé\n>\n> Énoncé.\n\n> [!qcm]\n>\n> 1. Question\n>    - [x] oui\n>    - [ ] non\n',
    );
    const { markdown } = contentToMarkdown({
      type: 'doc',
      content: [{ type: 'paragraph' }, ...(source.document.content ?? [])],
    });

    expect(markdown).toBe(
      '> [!exercice] Sans corrigé\n>\n> Énoncé.\n\n> [!qcm]\n>\n> 1. Question\n>    - [x] oui\n>    - [ ] non\n',
    );
    expect(reread(source.document)).toEqual(source.document);
  });

  it('garde la source enregistrée d’une figure, avec sa légende', () => {
    const { markdown } = contentToMarkdown(
      doc({
        type: 'figure',
        attrs: { src: '/api/courses/16/images/42', alt: 'Schéma' },
        content: [text('Figure 1 : "états"')],
      }),
    );

    expect(markdown).toBe(
      '![Schéma](/api/courses/16/images/42 "Figure 1 : \\"états\\"")\n',
    );
  });

  it('signale ce que le Markdown ne sait pas exprimer', () => {
    const example = JSON.parse(
      contract('course-content.example.json'),
    ) as ContentNode;

    expect(contentToMarkdown(example).losses).toEqual([
      'alignement d’un paragraphe ou d’un titre',
      'soulignement',
      'alignement vertical dans un tableau',
    ]);
  });

  it('écrit les contenus d’exemple de l’éditeur dans un Markdown que l’import accepte', () => {
    const course = contentToMarkdown(
      JSON.parse(contract('course-content.example.json')) as ContentNode,
    ).markdown.replace(
      /\/api\/courses\/\d+\/images\/(\d+)/g,
      'images/fig-$1.svg',
    );
    const exercises = JSON.parse(
      contract('exercises-content.example.json'),
    ) as ContentNode;
    const reread = markdownToContent(
      contentToMarkdown(exercises).markdown.replace(
        /\/api\/courses\/\d+\/images\/(\d+)/g,
        'images/fig-$1.svg',
      ),
    );
    const outline = (document: ContentNode): unknown[] =>
      (document.content ?? [])
        .filter((block) => (block.content ?? []).length > 0)
        .map((block) => [
          block.type,
          block.attrs?.['title'],
          block.attrs?.['key'],
        ]);

    expect(markdownToContent(course).errors).toEqual([]);
    expect(reread.errors).toEqual([]);
    expect(outline(reread.document)).toEqual(outline(exercises));
  });

  it('signale les pertes d’un tableau', () => {
    const cell = (
      type: string,
      attrs: Record<string, unknown>,
      ...blocks: ContentNode[]
    ): ContentNode => ({
      type,
      attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs },
      content: blocks,
    });
    const mark: ContentMark = { type: 'underline' };
    const table: ContentNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            cell('tableCell', { colspan: 2 }, paragraph(text('A'))),
            cell('tableCell', { colwidth: [120] }, paragraph(text('B'))),
          ],
        },
        {
          type: 'tableRow',
          content: [
            cell(
              'tableHeader',
              { align: 'right' },
              paragraph(text('1')),
              paragraph(text('2')),
            ),
            cell(
              'tableCell',
              { verticalAlign: 'middle' },
              paragraph(
                { type: 'text', text: 'c', marks: [mark] },
                { type: 'hardBreak' },
                text('d'),
              ),
            ),
          ],
        },
      ],
    };

    const { markdown, losses } = contentToMarkdown(doc(table));

    expect(markdown).toBe('| A | B |\n| --- | --- |\n| 1 2 | c d |\n');
    expect(losses.sort()).toEqual([
      'alignement propre à une cellule de tableau',
      'alignement vertical dans un tableau',
      'cellule de tableau qui contient plus d’un paragraphe',
      'cellules d’en-tête ailleurs que sur la première ligne d’un tableau',
      'cellules fusionnées',
      'largeurs de colonnes',
      'retour à la ligne dans un titre ou une cellule de tableau',
      'soulignement',
      'tableau sans ligne d’en-tête',
    ]);
  });
});
