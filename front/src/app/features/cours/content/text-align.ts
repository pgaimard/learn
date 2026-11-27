import { Editor, Extension } from '@tiptap/core';

// Alignement d'un paragraphe ou d'un titre, et alignement vertical d'une cellule de tableau.
// Ces listes doivent rester alignées sur la liste blanche de l'API
// (api/src/courses/content/content-schema.ts).
export const TEXT_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];
export const VERTICAL_ALIGNMENTS = ['top', 'middle', 'bottom'] as const;
export type VerticalAlignment = (typeof VERTICAL_ALIGNMENTS)[number];

const ALIGNED_BLOCKS = ['paragraph', 'heading'];
const CELLS = ['tableCell', 'tableHeader'];
const CLASS_PREFIX = 'align-';
const VERTICAL_CLASS_PREFIX = 'valign-';

function isAlignment(value: unknown): value is TextAlignment {
  return TEXT_ALIGNMENTS.some((alignment) => alignment === value);
}

function isVerticalAlignment(value: unknown): value is VerticalAlignment {
  return VERTICAL_ALIGNMENTS.some((alignment) => alignment === value);
}

// Valeur portée par la classe de ce préfixe, si elle est de celles qu'on accepte.
function classValue<T extends string>(
  element: HTMLElement,
  prefix: string,
  isAccepted: (value: unknown) => value is T,
): T | null {
  const found = Array.from(element.classList)
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
    .find(isAccepted);
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

// Aligne en hauteur le contenu des cellules sélectionnées, ou de celle du curseur ; null
// rend l'alignement par défaut, en haut.
export function setCellVerticalAlign(editor: Editor, alignment: VerticalAlignment | null): boolean {
  return editor.chain().focus().setCellAttribute('verticalAlign', alignment).run();
}

// Attribut « textAlign » des paragraphes et des titres, et « verticalAlign » des cellules
// de tableau, rendus par une classe : aucune mise en forme libre n'entre dans le contenu.
export const TextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ALIGNED_BLOCKS,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => classValue(element, CLASS_PREFIX, isAlignment),
            renderHTML: (attributes) =>
              isAlignment(attributes['textAlign'])
                ? { class: `${CLASS_PREFIX}${attributes['textAlign']}` }
                : {},
          },
        },
      },
      {
        types: CELLS,
        attributes: {
          verticalAlign: {
            default: null,
            parseHTML: (element) => classValue(element, VERTICAL_CLASS_PREFIX, isVerticalAlignment),
            renderHTML: (attributes) =>
              isVerticalAlignment(attributes['verticalAlign'])
                ? { class: `${VERTICAL_CLASS_PREFIX}${attributes['verticalAlign']}` }
                : {},
          },
        },
      },
    ];
  },
});
