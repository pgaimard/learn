import { readFileSync } from 'node:fs';
import { ContentNode } from './content-node.js';
import { validateContent } from './validate-content.js';

function doc(...content: ContentNode[]): ContentNode {
  return { type: 'doc', content };
}

function paragraph(text: string, marks?: ContentNode['marks']): ContentNode {
  return { type: 'paragraph', content: [{ type: 'text', text, marks }] };
}

describe('validateContent', () => {
  it('accepte le cours d’exemple partagé avec le front', () => {
    const example: unknown = JSON.parse(
      readFileSync(
        new URL(
          '../../../../contracts/course-content.example.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );

    expect(validateContent(example)).toEqual([]);
  });

  it('accepte un document utilisant tous les blocs autorisés', () => {
    const document = doc(
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Section' }],
      },
      paragraph('Texte', [
        { type: 'bold' },
        {
          type: 'link',
          attrs: {
            href: 'https://cnam.fr',
            target: '_blank',
            rel: null,
            class: null,
          },
        },
      ]),
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [paragraph('Un')] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 1, type: null },
        content: [{ type: 'listItem', content: [paragraph('Deux')] }],
      },
      { type: 'blockquote', content: [paragraph('Citation')] },
      {
        type: 'codeBlock',
        attrs: { language: 'c' },
        content: [{ type: 'text', text: 'int main() {}' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { colspan: 1, rowspan: 1, colwidth: null },
                content: [paragraph('En-tête')],
              },
              {
                type: 'tableCell',
                attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
                content: [paragraph('Cellule')],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      { type: 'paragraph' },
    );

    expect(validateContent(document)).toEqual([]);
  });

  it('refuse ce qui n’est pas un document', () => {
    expect(validateContent('<script>')).toEqual([
      'Le contenu doit être un document de l’éditeur.',
    ]);
    expect(validateContent({ type: 'paragraph' })).toHaveLength(1);
  });

  it('refuse un bloc inconnu', () => {
    const errors = validateContent(
      doc({ type: 'iframe', attrs: { src: 'https://x' } }),
    );

    expect(errors).toEqual(['Bloc non autorisé : « iframe ».']);
  });

  it('refuse un bloc mal placé', () => {
    const errors = validateContent(
      doc({ type: 'listItem', content: [paragraph('x')] }),
    );

    expect(errors).toEqual([
      'Le bloc « listItem » n’est pas autorisé dans « doc ».',
    ]);
  });

  it('refuse un attribut inconnu', () => {
    const errors = validateContent(
      doc({ type: 'heading', attrs: { level: 2, onclick: 'alert(1)' } }),
    );

    expect(errors).toEqual([
      'Attribut non autorisé sur « heading » : « onclick ».',
    ]);
  });

  it('réserve le titre de niveau 1 au titre du cours', () => {
    const errors = validateContent(
      doc({ type: 'heading', attrs: { level: 1 } }),
    );

    expect(errors).toEqual([
      'Valeur non autorisée pour « level » sur « heading ».',
    ]);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    ' javascript:alert(1)',
    'vbscript:x',
  ])('refuse le lien « %s »', (href) => {
    const errors = validateContent(
      doc(paragraph('x', [{ type: 'link', attrs: { href } }])),
    );

    expect(errors).toEqual([
      'Valeur non autorisée pour « href » sur « link ».',
    ]);
  });

  it('refuse une marque inconnue', () => {
    const errors = validateContent(
      doc(paragraph('x', [{ type: 'textStyle' }])),
    );

    expect(errors).toEqual(['Marque non autorisée : « textStyle ».']);
  });

  it('refuse une propriété inconnue sur un bloc', () => {
    const errors = validateContent(
      doc({
        type: 'paragraph',
        html: '<img onerror=x>',
      } as unknown as ContentNode),
    );

    expect(errors).toEqual([
      'Propriété non autorisée sur « paragraph » : « html ».',
    ]);
  });

  it('refuse un type d’encadré inconnu', () => {
    const errors = validateContent(
      doc({
        type: 'callout',
        attrs: { kind: 'publicité' },
        content: [paragraph('x')],
      }),
    );

    expect(errors).toEqual([
      'Valeur non autorisée pour « kind » sur « callout ».',
    ]);
  });

  it('refuse une liste vide', () => {
    expect(validateContent(doc({ type: 'bulletList' }))).toEqual([
      'Le bloc « bulletList » ne peut pas être vide.',
    ]);
  });

  it('refuse un document trop imbriqué', () => {
    let nested: ContentNode = paragraph('fond');
    for (let depth = 0; depth < 40; depth++) {
      nested = { type: 'blockquote', content: [nested] };
    }

    expect(validateContent(doc(nested))).toEqual([
      'Le contenu est trop volumineux ou trop imbriqué.',
    ]);
  });
});
