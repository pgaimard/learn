import { Extension } from '@tiptap/core';

// Blocs qui ont pu être épinglés à l'ancienne fiche de révision, calculée à partir du cours.
const PINNED_TYPES = [
  'paragraph',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'table',
  'figure',
  'callout',
];

// Attribut « pinned » des cours écrits avant la fiche de révision rédigée. Il n'a plus
// d'effet, mais l'éditeur le relit et le réécrit tel quel : ouvrir puis enregistrer un
// cours ne change pas ce que la base en garde.
export const RevisionPin = Extension.create({
  name: 'revisionPin',

  addGlobalAttributes() {
    return [
      {
        types: PINNED_TYPES,
        attributes: {
          pinned: {
            default: false,
            parseHTML: (element) => element.hasAttribute('data-pinned'),
            renderHTML: (attributes) =>
              attributes['pinned'] === true ? { 'data-pinned': '' } : {},
          },
        },
      },
    ];
  },
});
