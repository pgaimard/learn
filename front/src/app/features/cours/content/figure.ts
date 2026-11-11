import { mergeAttributes, Node } from '@tiptap/core';

// Image d'un cours avec sa légende. La légende est le contenu modifiable du bloc ;
// l'image elle-même est désignée par son adresse interne, jamais embarquée.
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'inline*',
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (element) => element.querySelector('img')?.getAttribute('src') ?? '',
      },
      alt: {
        default: '',
        parseHTML: (element) => element.querySelector('img')?.getAttribute('alt') ?? '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure', contentElement: 'figcaption' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const image = { src: String(node.attrs['src']), alt: String(node.attrs['alt']) };
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { src: null, alt: null }),
      ['img', { ...image, draggable: 'false', contenteditable: 'false' }],
      ['figcaption', 0],
    ];
  },
});
