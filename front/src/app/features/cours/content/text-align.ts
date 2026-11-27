import { Editor, Extension } from '@tiptap/core';

// Alignement d'un paragraphe ou d'un titre. Cette liste doit rester alignée sur la liste
// blanche de l'API (api/src/courses/content/content-schema.ts).
export const TEXT_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

const ALIGNED_BLOCKS = ['paragraph', 'heading'];
const CLASS_PREFIX = 'align-';

function isAlignment(value: unknown): value is TextAlignment {
  return TEXT_ALIGNMENTS.some((alignment) => alignment === value);
}

function alignmentOf(element: HTMLElement): TextAlignment | null {
  const found = Array.from(element.classList)
    .filter((name) => name.startsWith(CLASS_PREFIX))
    .map((name) => name.slice(CLASS_PREFIX.length))
    .find(isAlignment);
  return found ?? null;
}

// Aligne les paragraphes et les titres de la sélection ; null rend l'alignement par défaut.
export function setTextAlign(editor: Editor, alignment: TextAlignment | null): boolean {
  return editor
    .chain()
    .focus()
    .updateAttributes('paragraph', { textAlign: alignment })
    .updateAttributes('heading', { textAlign: alignment })
    .run();
}

// Attribut « textAlign » des paragraphes et des titres, rendu par une classe : aucune
// mise en forme libre n'entre dans le contenu.
export const TextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ALIGNED_BLOCKS,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: alignmentOf,
            renderHTML: (attributes) =>
              isAlignment(attributes['textAlign'])
                ? { class: `${CLASS_PREFIX}${attributes['textAlign']}` }
                : {},
          },
        },
      },
    ];
  },
});
