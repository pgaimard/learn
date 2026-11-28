import { ContentNode } from './content-node.js';
import { ensureHeadingIds, isHeadingId } from './heading-ids.js';

function heading(id?: unknown): ContentNode {
  return {
    type: 'heading',
    attrs: id === undefined ? { level: 2 } : { level: 2, id },
    content: [{ type: 'text', text: 'Titre' }],
  };
}

function ids(document: ContentNode): unknown[] {
  return (document.content ?? []).map((block) => block.attrs?.['id']);
}

describe('ensureHeadingIds', () => {
  it('garde un identifiant valide et en donne un aux titres qui n’en ont pas', () => {
    const document = ensureHeadingIds({
      type: 'doc',
      content: [
        heading('abcd1234'),
        heading(),
        heading(null),
        heading('Trop long !'),
      ],
    });

    expect(ids(document)[0]).toBe('abcd1234');
    expect(ids(document).every(isHeadingId)).toBe(true);
    expect(new Set(ids(document)).size).toBe(4);
  });

  it('renouvelle l’identifiant d’un titre copié, y compris dans un bloc imbriqué', () => {
    const document = ensureHeadingIds({
      type: 'doc',
      content: [
        heading('abcd1234'),
        {
          type: 'callout',
          attrs: { kind: 'retenir' },
          content: [heading('abcd1234')],
        },
      ],
    });
    const nested = document.content?.[1].content?.[0].attrs?.['id'];

    expect(ids(document)[0]).toBe('abcd1234');
    expect(isHeadingId(nested)).toBe(true);
    expect(nested).not.toBe('abcd1234');
  });

  it('ne modifie pas le document reçu', () => {
    const source = { type: 'doc', content: [heading()] };

    ensureHeadingIds(source);

    expect(source.content[0].attrs).toEqual({ level: 2 });
  });
});
