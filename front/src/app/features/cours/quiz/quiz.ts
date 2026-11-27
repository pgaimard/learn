import { Editor, mergeAttributes, Node } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, Transaction } from '@tiptap/pm/state';
import { gradeQuiz, resetQuiz, scoreLabel } from './quiz-answers';
import {
  addChoice,
  addChoiceAfterSelection,
  addQuestion,
  moveQuestion,
  removeChoice,
  removeEmptyChoiceAtSelection,
  removeQuestion,
} from './quiz-commands';

// Événements émis par un QCM en lecture : il vient d'être validé (avec son score), ou son
// historique est demandé.
export const QUIZ_CHECKED = 'quizchecked';
export const QUIZ_HISTORY = 'quizhistory';

type Change = (state: EditorState, pos: number) => Transaction | null;

// Numéro des choix dessinés : chaque case est nommée par le texte de son choix.
let choiceCount = 0;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}

// Partie d'un bloc que l'éditeur ne traite pas comme du contenu.
function chrome(className: string): HTMLDivElement {
  const created = element('div', className);
  created.contentEditable = 'false';
  return created;
}

function button(className: string, text: string, label = text): HTMLButtonElement {
  const created = element('button', className);
  created.type = 'button';
  created.textContent = text;
  if (label !== text) {
    created.title = label;
    created.setAttribute('aria-label', label);
  }
  return created;
}

// Applique au document le changement calculé à la position du bloc, sans toucher au
// focus ni au défilement : la page reste où elle est, le curseur aussi.
function apply(editor: Editor, getPos: () => number | undefined, change: Change): void {
  const pos = getPos();
  const transaction = typeof pos === 'number' ? change(editor.state, pos) : null;
  if (transaction) {
    editor.view.dispatch(transaction);
  }
}

// Ajoute un élément où le curseur entre aussitôt : l'éditeur reprend le focus et montre
// l'endroit.
function insert(editor: Editor, getPos: () => number | undefined, change: Change): void {
  const pos = getPos();
  const transaction = typeof pos === 'number' ? change(editor.state, pos) : null;
  if (transaction) {
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
  }
}

function countLabel(count: number): string {
  return count > 1 ? `QCM · ${count} questions` : 'QCM · 1 question';
}

function isInside(target: EventTarget | null, parent: HTMLElement): boolean {
  return target instanceof globalThis.Node && parent.contains(target);
}

// QCM : une suite de questions. En lecture, on coche ses réponses (des cases partout, pour
// ne pas dire combien sont justes) puis on valide : chaque
// question est corrigée et son explication apparaît. En édition, on rédige les questions,
// on coche les bonnes réponses et on écrit les explications.
export const Quiz = Node.create({
  name: 'quiz',
  // Hors du groupe « block » : il ne se place qu'au premier niveau du document.
  content: 'quizQuestion+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (dom) => dom.getAttribute('data-title') ?? '',
        renderHTML: (attributes) => ({ 'data-title': String(attributes['title'] ?? '') }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section.quiz' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { class: 'quiz' }), 0];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = element('section', 'quiz');
      const header = chrome('quiz-header');
      const count = element('span', 'quiz-count');
      // Lecture : le titre est un texte. Édition : un champ.
      const title = element('span', 'quiz-title');
      const field = element('input', 'quiz-title-field');
      field.type = 'text';
      field.maxLength = 200;
      field.placeholder = 'Titre du QCM (facultatif)';
      field.setAttribute('aria-label', 'Titre du QCM');
      field.addEventListener('input', () =>
        apply(editor, getPos, (state, pos) => state.tr.setNodeAttribute(pos, 'title', field.value)),
      );
      header.append(count, title, field);
      const contentDOM = element('div', 'quiz-questions');
      const footer = chrome('quiz-footer');
      const add = button('button quiz-add', '+ Question');
      add.addEventListener('click', () => insert(editor, getPos, addQuestion));
      const check = button('button button-primary quiz-check', 'Valider');
      const score = element('span', 'quiz-score');
      score.setAttribute('role', 'status');
      const retry = button('button quiz-retry', 'Recommencer');
      // La page est prévenue du score : c'est elle qui l'enregistre dans l'historique.
      check.addEventListener('click', () => {
        const result = gradeQuiz(dom);
        score.textContent = scoreLabel(result);
        dom.dispatchEvent(new CustomEvent(QUIZ_CHECKED, { bubbles: true, detail: result }));
      });
      const history = button('button button-ghost quiz-history', 'Historique');
      history.addEventListener('click', () =>
        dom.dispatchEvent(new CustomEvent(QUIZ_HISTORY, { bubbles: true })),
      );
      retry.addEventListener('click', () => {
        resetQuiz(dom);
        score.textContent = '';
      });
      footer.append(add, check, score, retry, history);
      dom.append(header, contentDOM, footer);

      const show = (shown: ProseMirrorNode): void => {
        const text = String(shown.attrs['title'] ?? '');
        count.textContent = countLabel(shown.childCount);
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
          if (updated.type.name !== 'quiz') {
            return false;
          }
          show(updated);
          return true;
        },
        // Le champ du titre garde ses frappes, les boutons leurs clics.
        stopEvent: (event) => isInside(event.target, header) || isInside(event.target, footer),
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});

// Question d'un QCM : son énoncé, ses choix, puis son explication.
export const QuizQuestion = Node.create({
  name: 'quizQuestion',
  content: 'quizPrompt quizChoice{2,} quizExplanation',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div.quiz-question', contentElement: '.quiz-question-body' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'quiz-question' }),
      ['div', { class: 'quiz-question-body' }, 0],
    ];
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = element('div', 'quiz-question');
      // Barre de la question : son numéro (posé par la feuille de style), puis en lecture
      // son verdict, en édition de quoi la monter, la descendre ou la supprimer.
      const bar = chrome('quiz-bar');
      const verdict = element('span', 'quiz-verdict');
      const up = button('quiz-action', '↑', 'Monter la question');
      up.addEventListener('click', () =>
        apply(editor, getPos, (state, pos) => moveQuestion(state, pos, -1)),
      );
      const down = button('quiz-action', '↓', 'Descendre la question');
      down.addEventListener('click', () =>
        apply(editor, getPos, (state, pos) => moveQuestion(state, pos, 1)),
      );
      const remove = button('quiz-action', '✕', 'Supprimer la question');
      remove.addEventListener('click', () => apply(editor, getPos, removeQuestion));
      bar.append(element('span', 'quiz-number'), verdict, up, down, remove);
      const contentDOM = element('div', 'quiz-question-body');
      dom.append(bar, contentDOM);

      return {
        dom,
        contentDOM,
        update: (updated) => updated.type.name === 'quizQuestion',
        stopEvent: (event) => isInside(event.target, bar),
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});

// Énoncé d'une question.
export const QuizPrompt = Node.create({
  name: 'quizPrompt',
  content: '(paragraph | bulletList | orderedList | codeBlock | figure)+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.quiz-prompt' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'quiz-prompt' }), 0];
  },
});

// Choix d'une question, bonne réponse ou non.
export const QuizChoice = Node.create({
  name: 'quizChoice',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      correct: {
        default: false,
        parseHTML: (dom) => dom.getAttribute('data-correct') === 'true',
        renderHTML: (attributes) => ({ 'data-correct': String(attributes['correct'] === true) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.quiz-choice', contentElement: '.quiz-choice-text' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'quiz-choice' }),
      ['div', { class: 'quiz-choice-text' }, 0],
    ];
  },

  addKeyboardShortcuts() {
    const run = (change: (state: EditorState) => Transaction | null): boolean => {
      const transaction = change(this.editor.state);
      if (transaction) {
        this.editor.view.dispatch(transaction.scrollIntoView());
      }
      return transaction !== null;
    };
    return {
      // Entrée ouvre le choix suivant ; dans un choix, elle ne coupe jamais le texte.
      Enter: () =>
        this.editor.state.selection.$from.parent.type.name === 'quizChoice' &&
        (run(addChoiceAfterSelection) || true),
      Backspace: () => run(removeEmptyChoiceAtSelection),
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = element('div', 'quiz-choice');
      const box = element('input', 'quiz-choice-box');
      box.type = 'checkbox';
      const contentDOM = element('div', 'quiz-choice-text');
      contentDOM.id = `quiz-choice-${++choiceCount}`;
      box.setAttribute('aria-labelledby', contentDOM.id);
      const remove = button('quiz-action', '✕', 'Supprimer le choix');
      remove.contentEditable = 'false';
      remove.addEventListener('click', () => apply(editor, getPos, removeChoice));
      // Hors du texte éditable, la case reste cliquable dans tous les navigateurs.
      const check = element('span', 'quiz-choice-check');
      check.contentEditable = 'false';
      check.append(box);
      dom.append(check, contentDOM, remove);

      // Édition : la case désigne une bonne réponse. Lecture : elle porte la réponse
      // donnée, qui reste dans la page.
      box.addEventListener('change', () => {
        if (editor.isEditable) {
          apply(editor, getPos, (state, pos) =>
            state.tr.setNodeAttribute(pos, 'correct', box.checked),
          );
        }
      });
      // Lecture : un clic sur le texte du choix coche sa case, sauf sur un lien, un terme
      // ou un renvoi, qui gardent leur action.
      contentDOM.addEventListener('click', (event) => {
        const target = event.target;
        const isLink =
          target instanceof Element && target.closest('a, .term-mention, .section-ref') !== null;
        if (!editor.isEditable && !box.disabled && !isLink) {
          box.click();
        }
      });

      const show = (shown: ProseMirrorNode): void => {
        const isCorrect = shown.attrs['correct'] === true;
        dom.dataset['correct'] = String(isCorrect);
        if (editor.isEditable) {
          box.checked = isCorrect;
          box.title = 'Bonne réponse';
        }
      };
      show(node);

      return {
        dom,
        contentDOM,
        update: (updated) => {
          if (updated.type.name !== 'quizChoice') {
            return false;
          }
          show(updated);
          return true;
        },
        stopEvent: (event) => event.target === box || isInside(event.target, remove),
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});

// Explication d'une question, montrée en lecture une fois le QCM validé.
export const QuizExplanation = Node.create({
  name: 'quizExplanation',
  // Tout bloc du cours sauf un titre, qui entrerait dans le sommaire.
  content:
    '(paragraph | bulletList | orderedList | blockquote | codeBlock | table | figure | callout)+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.quiz-explanation', contentElement: '.quiz-explanation-body' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'quiz-explanation' }),
      ['div', { class: 'quiz-explanation-body' }, 0],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = element('div', 'quiz-explanation');
      // Au-dessus de l'explication, donc sous les choix : de quoi en ajouter un.
      const tools = chrome('quiz-explanation-tools');
      const add = button('button quiz-add', '+ Choix');
      add.addEventListener('click', () =>
        insert(editor, getPos, (state, pos) => addChoice(state, state.doc.resolve(pos).before())),
      );
      const label = element('span', 'quiz-explanation-label');
      label.textContent = 'Explication';
      tools.append(add, label);
      const contentDOM = element('div', 'quiz-explanation-body');
      dom.append(tools, contentDOM);

      // Une explication laissée vide ne s'affiche pas en lecture.
      const show = (shown: ProseMirrorNode): void => {
        dom.classList.toggle('is-empty', shown.textContent.trim().length === 0);
      };
      show(node);

      return {
        dom,
        contentDOM,
        update: (updated) => {
          if (updated.type.name !== 'quizExplanation') {
            return false;
          }
          show(updated);
          return true;
        },
        stopEvent: (event) => isInside(event.target, tools),
        ignoreMutation: (mutation) => !contentDOM.contains(mutation.target),
      };
    };
  },
});
