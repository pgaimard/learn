import { readFileSync } from 'node:fs';
import { ContentNode } from '../content/content-node.js';
import { validateContent } from '../content/validate-content.js';
import { markdownToContent } from './markdown-to-content.js';
import { parseFrontMatter } from './parse-front-matter.js';

const MARKDOWN = `## 1. Processus

Un **processus** est un *programme* en ~~attente~~ exécution, voir \`fork()\` et la
[documentation](https://www.cnam.fr "CNAM").

### 1.1 États

- Prêt
- Élu

1. Un
2. Deux

> Citation simple.

> [!retenir]
> Un processus a son propre espace d'adressage.

> [!attention]
>
> - Premier point
> - Second point

![Schéma des états](images/fig-01.svg "Figure 1 : états d'un processus")

\`\`\`c
int main(void) { return 0; }
\`\`\`

| Algorithme | Préemptif |
|:-----------|----------:|
| FIFO       | Non       |

---

#### 1.1.1 Détail

Fin.
`;

function types(document: ContentNode): string[] {
  return (document.content ?? []).map((node) => node.type);
}

describe('markdownToContent', () => {
  const converted = markdownToContent(MARKDOWN);
  const blocks = converted.document.content ?? [];

  it('convertit chaque bloc du contrat sans erreur', () => {
    expect(converted.errors).toEqual([]);
    expect(types(converted.document)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'callout',
      'callout',
      'figure',
      'codeBlock',
      'table',
      'horizontalRule',
      'heading',
      'paragraph',
    ]);
    expect(converted.sectionCount).toBe(1);
  });

  it('produit un contenu accepté par la liste blanche une fois les images placées', () => {
    const withSources = JSON.parse(
      JSON.stringify(converted.document).replace(
        'images/fig-01.svg',
        '/api/courses/1/images/1',
      ),
    ) as ContentNode;

    expect(validateContent(withSources)).toEqual([]);
  });

  it('garde la mise en forme et sécurise les liens', () => {
    const paragraph = blocks[1].content ?? [];

    expect(paragraph.map((node) => node.marks?.[0]?.type ?? null)).toEqual([
      null,
      'bold',
      null,
      'italic',
      null,
      'strike',
      null,
      'code',
      null,
      'link',
      null,
    ]);
    expect(paragraph[9].marks?.[0].attrs).toEqual({
      href: 'https://www.cnam.fr',
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
      class: null,
      title: 'CNAM',
    });
  });

  it('transforme une citation marquée en encadré sans garder le marqueur', () => {
    expect(blocks[6]).toEqual({
      type: 'callout',
      attrs: { kind: 'retenir' },
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: "Un processus a son propre espace d'adressage.",
            },
          ],
        },
      ],
    });
    expect(blocks[7].attrs).toEqual({ kind: 'attention' });
    expect(blocks[7].content?.[0].type).toBe('bulletList');
  });

  it('fait d’une image seule une figure avec texte alternatif et légende', () => {
    expect(blocks[8]).toEqual({
      type: 'figure',
      attrs: { src: 'images/fig-01.svg', alt: 'Schéma des états' },
      content: [{ type: 'text', text: "Figure 1 : états d'un processus" }],
    });
    expect(converted.imagePaths).toEqual(['images/fig-01.svg']);
  });

  it('reprend le langage du code et l’alignement des colonnes', () => {
    expect(blocks[9].attrs).toEqual({ language: 'c' });
    const header = blocks[10].content?.[0].content ?? [];
    expect(header.map((cell) => [cell.type, cell.attrs?.['align']])).toEqual([
      ['tableHeader', 'left'],
      ['tableHeader', 'right'],
    ]);
  });

  it('ne fait pas un lien d’une adresse javascript', () => {
    const { document, errors } = markdownToContent(
      '[clic](javascript:alert(1))',
    );

    expect(errors).toEqual([]);
    expect(JSON.stringify(document)).not.toContain('"link"');
  });

  it('laisse le HTML à l’état de texte', () => {
    const { document, errors } = markdownToContent(
      '<script>alert(1)</script>\n\n<b>x</b>',
    );

    expect(errors).toEqual([]);
    expect(validateContent(document)).toEqual([]);
    expect(JSON.stringify(document)).toContain('<script>alert(1)</script>');
    expect(types(document)).toEqual(['paragraph', 'paragraph']);
  });

  it.each([
    ['# Titre de niveau 1', 'ligne 1 : titre de niveau 1 non pris en charge'],
    ['###### Trop profond', 'titre de niveau 6 non pris en charge'],
    ['Texte\n\n> [!note]\n> x', 'ligne 3 : type d’encadré inconnu « note »'],
    ['> [!retenir]', 'encadré vide'],
    [
      '![x](https://evil.example/x.png)',
      'image « https://evil.example/x.png » refusée',
    ],
    ['![x](images/../../etc/passwd.png)', 'refusée'],
    [
      'Texte ![x](images/fig-01.png) suite',
      'une image doit être seule dans son paragraphe',
    ],
    ['[clic](ftp://serveur/fichier)', 'lien « ftp://serveur/fichier » refusé'],
  ])('signale précisément « %s »', (markdown, expected) => {
    const { errors } = markdownToContent(markdown);

    expect(errors.join('\n')).toMatch(new RegExp(expected));
  });

  it('situe les erreurs dans le fichier d’origine, en-tête compris', () => {
    const { body, lineOffset } = parseFrontMatter(
      '---\nue: UTC502\ntitre: Test\nordre: 1\n---\n\n# Mauvais niveau\n',
    );

    expect(markdownToContent(body, lineOffset).errors[0]).toContain('ligne 7');
  });

  it('accepte le cours d’exemple du contrat', () => {
    const example = readFileSync(
      new URL('../../../../contracts/cours.example.md', import.meta.url),
      'utf8',
    );
    const { body, lineOffset, metadata, errors } = parseFrontMatter(example);

    expect(errors).toEqual([]);
    expect(metadata).toEqual({
      ueCode: 'UTC502',
      title: 'Les processus : notions de base',
      position: 3,
    });
    expect(markdownToContent(body, lineOffset).errors).toEqual([]);
  });
});

describe('parseFrontMatter', () => {
  it.each([
    ['sans en-tête', '## Titre', 'doit commencer par un en-tête'],
    ['sans UE', '---\ntitre: T\nordre: 1\n---\n', 'champ « ue »'],
    ['sans titre', '---\nue: UTC502\nordre: 1\n---\n', 'champ « titre »'],
    [
      'avec un ordre invalide',
      '---\nue: UTC502\ntitre: T\nordre: trois\n---\n',
      'champ « ordre »',
    ],
  ])('refuse un fichier %s', (_label, markdown, expected) => {
    expect(parseFrontMatter(markdown).errors.join('\n')).toContain(expected);
  });

  it('accepte un titre entre guillemets et un code en minuscules', () => {
    const { metadata } = parseFrontMatter(
      '---\nue: utc502\ntitre: "Les processus"\nordre: 0\n---\n',
    );

    expect(metadata).toEqual({
      ueCode: 'UTC502',
      title: 'Les processus',
      position: 0,
    });
  });
});
