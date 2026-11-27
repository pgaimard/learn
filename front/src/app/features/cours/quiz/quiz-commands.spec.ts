import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { ContentNode } from '../content/content-node';
import { createCourseExtensions } from '../content/course-extensions';
import {
  addChoice,
  addChoiceAfterSelection,
  addQuestion,
  insertQuiz,
  moveQuestion,
  removeChoice,
  removeEmptyChoiceAtSelection,
  removeQuestion,
} from './quiz-commands';

function text(value: string): ContentNode[] {
  return value ? [{ type: 'text', text: value }] : [];
}

function question(prompt: string, ...choices: string[]): ContentNode {
  return {
    type: 'quizQuestion',
    content: [
      { type: 'quizPrompt', content: [{ type: 'paragraph', content: text(prompt) }] },
      ...choices.map((choice) => ({
        type: 'quizChoice',
        attrs: { correct: false },
        content: text(choice),
      })),
      { type: 'quizExplanation', content: [{ type: 'paragraph' }] },
    ],
  };
}

describe('commandes du QCM', () => {
  let editor: Editor;

  function setup(...content: ContentNode[]): void {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: { type: 'doc', content },
    });
  }

  function quizOf(...questions: ContentNode[]): ContentNode {
    return { type: 'quiz', attrs: { title: '' }, content: questions };
  }

  afterEach(() => editor.destroy());

  // Position du premier nœud de ce type qui contient ce texte.
  function posOf(type: string, containing = ''): number {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (found < 0 && node.type.name === type && node.textContent.includes(containing)) {
        found = pos;
      }
    });
    return found;
  }

  function prompts(): string[] {
    const found: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'quizPrompt') {
        found.push(node.textContent);
      }
    });
    return found;
  }

  function choices(): string[] {
    const found: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'quizChoice') {
        found.push(node.textContent);
      }
    });
    return found;
  }

  function apply(transaction: ReturnType<typeof addQuestion>): void {
    expect(transaction).not.toBeNull();
    if (transaction) {
      editor.view.dispatch(transaction);
    }
  }

  function placeCursorIn(type: string, containing = ''): void {
    const pos = posOf(type, containing);
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos + 1)),
    );
  }

  it('remplace le paragraphe vide du curseur par un QCM d’une question à deux choix', () => {
    setup({ type: 'paragraph' });

    editor.commands.command(({ tr }) => insertQuiz(tr));

    const quiz = editor.state.doc.firstChild;
    expect(quiz?.type.name).toBe('quiz');
    expect(quiz?.firstChild?.childCount).toBe(4);
    expect(editor.state.selection.$from.node(-1).type.name).toBe('quizPrompt');
  });

  it('pose le QCM après le bloc de premier niveau quand le curseur est dans du texte', () => {
    setup({
      type: 'callout',
      attrs: { kind: 'retenir' },
      content: [{ type: 'paragraph', content: text('Dedans.') }],
    });
    placeCursorIn('paragraph', 'Dedans');

    editor.commands.command(({ tr }) => insertQuiz(tr));

    expect(editor.state.doc.child(0).type.name).toBe('callout');
    expect(editor.state.doc.child(1).type.name).toBe('quiz');
  });

  it('ajoute une question à la fin et y place le curseur', () => {
    setup(quizOf(question('Un', 'a', 'b')));

    apply(addQuestion(editor.state, posOf('quiz')));

    expect(prompts()).toEqual(['Un', '']);
    expect(editor.state.selection.$from.node(-1).type.name).toBe('quizPrompt');
  });

  it('monte et descend une question, sans sortir du QCM', () => {
    setup(quizOf(question('Un', 'a', 'b'), question('Deux', 'c', 'd')));

    apply(moveQuestion(editor.state, posOf('quizQuestion', 'Deux'), -1));
    expect(prompts()).toEqual(['Deux', 'Un']);
    apply(moveQuestion(editor.state, posOf('quizQuestion', 'Deux'), 1));
    expect(prompts()).toEqual(['Un', 'Deux']);

    expect(moveQuestion(editor.state, posOf('quizQuestion', 'Un'), -1)).toBeNull();
    expect(moveQuestion(editor.state, posOf('quizQuestion', 'Deux'), 1)).toBeNull();
  });

  it('supprime une question, et le QCM avec la dernière', () => {
    setup(quizOf(question('Un', 'a', 'b'), question('Deux', 'c', 'd')));

    apply(removeQuestion(editor.state, posOf('quizQuestion', 'Un')));
    expect(prompts()).toEqual(['Deux']);

    apply(removeQuestion(editor.state, posOf('quizQuestion', 'Deux')));
    expect(posOf('quiz')).toBe(-1);
  });

  it('ajoute un choix à la fin de ceux de la question, dix au plus', () => {
    setup(quizOf(question('Un', 'a', 'b')));

    apply(addChoice(editor.state, posOf('quizQuestion')));
    expect(choices()).toEqual(['a', 'b', '']);
    expect(editor.state.selection.$from.parent.type.name).toBe('quizChoice');

    for (let count = 3; count < 10; count++) {
      apply(addChoice(editor.state, posOf('quizQuestion')));
    }
    expect(addChoice(editor.state, posOf('quizQuestion'))).toBeNull();
  });

  it('ouvre un choix après celui du curseur', () => {
    setup(quizOf(question('Un', 'a', 'b')));
    placeCursorIn('quizChoice', 'a');

    apply(addChoiceAfterSelection(editor.state));

    expect(choices()).toEqual(['a', '', 'b']);
  });

  it('supprime un choix tant qu’il en reste deux', () => {
    setup(quizOf(question('Un', 'a', 'b', 'c')));

    apply(removeChoice(editor.state, posOf('quizChoice', 'b')));
    expect(choices()).toEqual(['a', 'c']);

    expect(removeChoice(editor.state, posOf('quizChoice', 'a'))).toBeNull();
  });

  it('retire le choix vide du curseur, qui remonte dans le choix précédent', () => {
    setup(quizOf(question('Un', 'a', 'b', '')));
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, posOf('quizExplanation') - 1),
      ),
    );

    apply(removeEmptyChoiceAtSelection(editor.state));

    expect(choices()).toEqual(['a', 'b']);
    expect(editor.state.selection.$from.parent.textContent).toBe('b');
  });
});
