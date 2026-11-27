import { mergeAttributes, Node } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection, Transaction } from '@tiptap/pm/state';
import { ContentNode } from '../content/content-node';

// Exercice ouvert en lecture : de quoi le faire dans sa fenêtre.
export interface OpenedExercise {
  key: string;
  title: string;
  // Énoncé et corrigé, chacun comme un document à afficher.
  statement: ContentNode;
  solution: ContentNode;
}

// Blocs admis dans l'énoncé et le corrigé : tout bloc du cours sauf un titre, qui
// entrerait dans le sommaire. La même liste que dans l'API.
const BODY =
  '(paragraph | bulletList | orderedList | blockquote | codeBlock | table | figure | callout)+';

// Clé d'un exercice créé dans l'éditeur : elle le désigne dans le cours et rattachera ses
// réponses. Même forme que dans l'API (minuscules, chiffres, tirets).
export function newExerciseKey(): string {
  return `exercice-${crypto.randomUUID().slice(0, 8)}`;
}

function documentOf(part: ProseMirrorNode): ContentNode {
  return { type: 'doc', content: (part.toJSON() as ContentNode).content ?? [] };
}

// Ce qu'il faut de l'exercice pour le faire : son énoncé et son corrigé, détachés du cours.
export function openedExercise(exercise: ProseMirrorNode): OpenedExercise {
  return {
    key: String(exercise.attrs['key'] ?? ''),
    title: String(exercise.attrs['title'] ?? ''),
    statement: documentOf(exercise.child(0)),
    solution: documentOf(exercise.child(1)),
  };
}

// Pose un exercice vide à la place du paragraphe vide du curseur, sinon après le bloc de
// premier niveau qui le contient. Le curseur entre dans l'énoncé.
export function insertExercise(transaction: Transaction): boolean {
  const { $from } = transaction.selection;
  if ($from.depth === 0) {
    return false;
  }
  const { nodes } = transaction.doc.type.schema;
  const exercise = nodes['exercise'].create({ key: newExerciseKey() }, [
    nodes['exerciseStatement'].create(null, nodes['paragraph'].create()),
    nodes['exerciseSolution'].create(null, nodes['paragraph'].create()),
  ]);
  const block = $from.node(1);
  const isEmptyParagraph =
    $from.depth === 1 && block.type.name === 'paragraph' && block.childCount === 0;
  const pos = isEmptyParagraph ? $from.before(1) : $from.after(1);
  if (isEmptyParagraph) {
    transaction.replaceWith(pos, pos + block.nodeSize, exercise);
  } else {
    transaction.insert(pos, exercise);
  }
  // Exercice, énoncé, paragraphe : trois balises avant le texte.
  transaction.setSelection(TextSelection.create(transaction.doc, pos + 3));
  return true;
}

// Exercice : un énoncé et son corrigé. En lecture, le corrigé est caché et un bouton ouvre
// la fenêtre où l'on répond ; en édition, on rédige les deux l'un sous l'autre.
export const Exercise = Node.create({
  name: 'exercise',
  // Hors du groupe « block » : il ne se place qu'au premier niveau du document.
  content: 'exerciseStatement exerciseSolution',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (dom) => dom.getAttribute('data-title') ?? '',
        renderHTML: (attributes) => ({ 'data-title': String(attributes['title'] ?? '') }),
      },
      key: {
        default: '',
        parseHTML: (dom) => dom.getAttribute('data-key') ?? '',
        renderHTML: (attributes) => ({ 'data-key': String(attributes['key'] ?? '') }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section.exercise' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { class: 'exercise' }), 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('section');
      dom.className = 'exercise';
      const header = document.createElement('div');
      header.className = 'exercise-header';
      header.contentEditable = 'false';
      const label = document.createElement('span');
      label.className = 'exercise-label';
      label.textContent = 'Exercice';
      // Lecture : le titre est un texte. Édition : un champ.
      const title = document.createElement('span');
      title.className = 'exercise-title';
      const field = document.createElement('input');
      field.type = 'text';
      field.className = 'exercise-title-field';
      field.maxLength = 200;
      field.placeholder = 'Titre de l’exercice (facultatif)';
      field.setAttribute('aria-label', 'Titre de l’exercice');
      // Sans toucher au focus ni au défilement : la saisie reste dans le champ.
      field.addEventListener('input', () => {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'title', field.value));
        }
      });
      header.append(label, title, field);
      const contentDOM = document.createElement('div');
      contentDOM.className = 'exercise-body';
      // Lecture : le bouton qui ouvre la fenêtre de l'exercice ; la page le reçoit.
      const footer = document.createElement('div');
      footer.className = 'exercise-footer';
      footer.contentEditable = 'false';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'button button-primary exercise-open';
      open.textContent = 'Faire l’exercice';
      footer.append(open);
      dom.append(header, contentDOM, footer);

      const show = (shown: ProseMirrorNode): void => {
        const text = String(shown.attrs['title'] ?? '');
        title.textContent = text;
        if (field.value !== text) {
          field.value = text;
        }
      };
      show(node);

      return {
        dom,
        contentDOM,
        update: (updated) => {
          if (updated.type.name !== 'exercise') {
            return false;
          }
          show(updated);
          return true;
        },
        stopEvent: (event) =>
          event.target instanceof globalThis.Node && header.contains(event.target),
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});

// Énoncé d'un exercice.
export const ExerciseStatement = Node.create({
  name: 'exerciseStatement',
  content: BODY,
  defining: true,

  parseHTML() {
    return [{ tag: 'div.exercise-statement' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'exercise-statement' }), 0];
  },
});

// Corrigé d'un exercice, caché en lecture : il se montre dans la fenêtre, une fois la
// réponse validée.
export const ExerciseSolution = Node.create({
  name: 'exerciseSolution',
  content: BODY,
  defining: true,

  parseHTML() {
    return [{ tag: 'div.exercise-solution' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'exercise-solution' }), 0];
  },
});
