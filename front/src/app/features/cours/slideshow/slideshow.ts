import { mergeAttributes, Node } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, TextSelection, Transaction } from '@tiptap/pm/state';

// Nombre d'étapes qu'un diaporama peut compter ; la même limite que dans l'API.
export const MAX_SLIDES = 60;

function countLabel(count: number): string {
  return count > 1 ? `Diaporama · ${count} étapes` : 'Diaporama · 1 étape';
}

function button(label: string, text: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'slide-action';
  element.title = label;
  element.setAttribute('aria-label', label);
  element.textContent = text;
  return element;
}

// Étape du diaporama placée à cette position, avec son diaporama ; null ailleurs.
function slideAt(
  state: EditorState,
  pos: number,
): { slide: ProseMirrorNode; index: number; show: ProseMirrorNode; showPos: number } | null {
  const $pos = state.doc.resolve(pos);
  const slide = $pos.nodeAfter;
  const show = $pos.parent;
  if (slide?.type.name !== 'slide' || show.type.name !== 'slideshow') {
    return null;
  }
  return { slide, index: $pos.index(), show, showPos: $pos.before() };
}

// Échange l'étape avec sa voisine du dessus (-1) ou du dessous (1). Renvoie null aux
// extrémités du diaporama.
export function moveSlide(state: EditorState, pos: number, direction: -1 | 1): Transaction | null {
  const found = slideAt(state, pos);
  const target = found ? found.index + direction : -1;
  if (!found || target < 0 || target >= found.show.childCount) {
    return null;
  }
  const neighbour = found.show.child(target);
  const from = direction === -1 ? pos - neighbour.nodeSize : pos;
  const pair = direction === -1 ? [found.slide, neighbour] : [neighbour, found.slide];
  return state.tr.replaceWith(from, from + found.slide.nodeSize + neighbour.nodeSize, pair);
}

// Supprime l'étape ; la dernière emporte le diaporama, qui ne peut pas rester vide.
export function removeSlide(state: EditorState, pos: number): Transaction | null {
  const found = slideAt(state, pos);
  if (!found) {
    return null;
  }
  return found.show.childCount === 1
    ? state.tr.delete(found.showPos, found.showPos + found.show.nodeSize)
    : state.tr.delete(pos, pos + found.slide.nodeSize);
}

// Diaporama qui contient la sélection, et position où finit l'étape du curseur ; null
// quand le curseur est ailleurs.
export function slideshowAtSelection(
  state: EditorState,
): { count: number; afterSlide: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'slide') {
      return { count: $from.node(depth - 1).childCount, afterSlide: $from.after(depth) };
    }
  }
  return null;
}

// Place le curseur dans l'explication de l'étape qui commence à cette position.
export function selectSlideText(transaction: Transaction, slidePos: number): Transaction {
  const slide = transaction.doc.nodeAt(slidePos);
  const figure = slide?.firstChild;
  if (!slide || !figure) {
    return transaction;
  }
  // Après la balise de l'étape et son image : le premier bloc de l'explication.
  const explanation = slidePos + 1 + figure.nodeSize + 1;
  return transaction.setSelection(TextSelection.create(transaction.doc, explanation));
}

// Document d'un cours : des blocs, et des diaporamas, des QCM et des exercices, qui ne se
// placent qu'à ce niveau (ni dans un encadré, ni dans un tableau, ni l'un dans l'autre).
export const CourseDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: '(block | slideshow | quiz | exercise)+',
});

// Diaporama : une suite d'étapes qu'on fait défiler dans une fenêtre, en lecture, pour
// suivre un déroulement image par image. En édition, ses étapes s'affichent l'une sous
// l'autre et se modifient comme le reste du cours.
export const Slideshow = Node.create({
  name: 'slideshow',
  // Hors du groupe « block » : il ne se place qu'au premier niveau du document.
  content: 'slide+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') ?? '',
        renderHTML: (attributes) => ({ 'data-title': String(attributes['title'] ?? '') }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section.slideshow' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { class: 'slideshow' }), 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('section');
      dom.className = 'slideshow';
      const header = document.createElement('div');
      header.className = 'slideshow-header';
      header.contentEditable = 'false';
      const count = document.createElement('span');
      count.className = 'slideshow-count';
      // Lecture : le titre est un texte. Édition : un champ.
      const title = document.createElement('span');
      title.className = 'slideshow-title';
      const field = document.createElement('input');
      field.type = 'text';
      field.className = 'slideshow-title-field';
      field.maxLength = 200;
      field.placeholder = 'Titre du diaporama (facultatif)';
      field.setAttribute('aria-label', 'Titre du diaporama');
      field.addEventListener('input', () => {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'title', field.value));
        }
      });
      header.append(count, title, field);
      const contentDOM = document.createElement('div');
      contentDOM.className = 'slideshow-steps';
      dom.append(header, contentDOM);

      const show = (shown: ProseMirrorNode): void => {
        const text = String(shown.attrs['title'] ?? '');
        count.textContent = countLabel(shown.childCount);
        title.textContent = text;
        if (field.value !== text) {
          field.value = text;
        }
        if (!editor.isEditable) {
          // Lecture : le bloc entier est le bouton qui ouvre la fenêtre.
          dom.tabIndex = 0;
          dom.setAttribute('role', 'button');
          dom.setAttribute('aria-label', `Ouvrir le diaporama ${text}`.trim());
        }
      };
      show(node);

      return {
        dom,
        contentDOM,
        update: (updated) => {
          if (updated.type.name !== 'slideshow') {
            return false;
          }
          show(updated);
          return true;
        },
        // Le champ du titre garde ses frappes : l'éditeur ne les traite pas.
        stopEvent: (event) => event.target === field,
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});

// Étape d'un diaporama : son image, dont la légende sert de titre d'étape, puis son
// explication.
export const Slide = Node.create({
  name: 'slide',
  content: 'figure (paragraph | bulletList | orderedList)+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.slide', contentElement: '.slide-body' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'slide' }),
      ['div', { class: 'slide-body' }, 0],
    ];
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'slide';
      // Barre de l'étape, en édition : son numéro (posé par la feuille de style) et de quoi
      // la monter, la descendre ou la supprimer.
      const bar = document.createElement('div');
      bar.className = 'slide-bar';
      bar.contentEditable = 'false';
      const act = (change: (state: EditorState, pos: number) => Transaction | null): void => {
        const pos = getPos();
        const transaction = typeof pos === 'number' ? change(editor.state, pos) : null;
        // Sans défilement : la page reste où elle est, même si le curseur est ailleurs.
        if (transaction) {
          editor.view.dispatch(transaction);
        }
      };
      const up = button('Monter l’étape', '↑');
      up.addEventListener('click', () => act((state, pos) => moveSlide(state, pos, -1)));
      const down = button('Descendre l’étape', '↓');
      down.addEventListener('click', () => act((state, pos) => moveSlide(state, pos, 1)));
      const remove = button('Supprimer l’étape', '✕');
      remove.addEventListener('click', () => act(removeSlide));
      const label = document.createElement('span');
      label.className = 'slide-number';
      bar.append(label, up, down, remove);
      const contentDOM = document.createElement('div');
      contentDOM.className = 'slide-body';
      dom.append(bar, contentDOM);
      return {
        dom,
        contentDOM,
        stopEvent: (event) => event.target instanceof globalThis.Node && bar.contains(event.target),
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});
