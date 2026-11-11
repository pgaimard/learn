import { buildOutline } from './build-outline';
import { ContentNode } from './content-node';

function heading(level: number, text: string): ContentNode {
  return { type: 'heading', attrs: { level }, content: text ? [{ type: 'text', text }] : [] };
}

describe('buildOutline', () => {
  it('liste les titres dans l’ordre avec leur niveau et leur numérotation d’origine', () => {
    const outline = buildOutline({
      type: 'doc',
      content: [
        heading(2, '1. Processus'),
        { type: 'paragraph', content: [{ type: 'text', text: 'Texte' }] },
        heading(3, '1.1 États'),
        heading(2, '2. Ordonnancement'),
      ],
    });

    expect(outline).toEqual([
      { index: 0, level: 2, text: '1. Processus' },
      { index: 1, level: 3, text: '1.1 États' },
      { index: 2, level: 2, text: '2. Ordonnancement' },
    ]);
  });

  it('assemble le texte d’un titre mis en forme', () => {
    const outline = buildOutline({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            { type: 'text', text: 'Appel ' },
            { type: 'text', text: 'fork()', marks: [{ type: 'code' }] },
          ],
        },
      ],
    });

    expect(outline[0].text).toBe('Appel fork()');
  });

  it('ignore un titre vide sans décaler le rang des suivants', () => {
    const outline = buildOutline({ type: 'doc', content: [heading(2, ''), heading(2, 'Suite')] });

    expect(outline).toEqual([{ index: 1, level: 2, text: 'Suite' }]);
  });

  it('trouve les titres placés dans un autre bloc', () => {
    const outline = buildOutline({
      type: 'doc',
      content: [{ type: 'blockquote', content: [heading(3, 'Dans une citation')] }],
    });

    expect(outline).toHaveLength(1);
  });
});
