import { Editor } from '@tiptap/core';
import { ContentNode } from '../content/content-node';
import { createCourseExtensions } from '../content/course-extensions';
import { applyChecked, readChecked } from './quiz-answers';

function choice(label: string, correct: boolean): ContentNode {
  return { type: 'quizChoice', attrs: { correct }, content: [{ type: 'text', text: label }] };
}

function question(explanation: string, ...choices: ContentNode[]): ContentNode {
  return {
    type: 'quizQuestion',
    content: [
      {
        type: 'quizPrompt',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Question ?' }] }],
      },
      ...choices,
      {
        type: 'quizExplanation',
        content: [
          {
            type: 'paragraph',
            content: explanation ? [{ type: 'text', text: explanation }] : [],
          },
        ],
      },
    ],
  };
}

const QUIZ: ContentNode = {
  type: 'quiz',
  attrs: { title: 'Processus' },
  content: [
    question('Parce que.', choice('a', true), choice('b', false)),
    question('', choice('c', true), choice('d', true), choice('e', false)),
  ],
};

describe('QCM', () => {
  let editor: Editor;
  let host: HTMLElement;

  function setup(editable: boolean): void {
    host = document.createElement('div');
    document.body.append(host);
    editor = new Editor({
      element: host,
      editable,
      extensions: createCourseExtensions(),
      content: { type: 'doc', content: [QUIZ] },
    });
  }

  afterEach(() => {
    editor.destroy();
    host.remove();
  });

  function boxes(): HTMLInputElement[] {
    return Array.from(host.querySelectorAll<HTMLInputElement>('.quiz-choice-box'));
  }

  function click(selector: string): void {
    host.querySelector<HTMLElement>(selector)?.click();
  }

  it('en lecture, ne propose que des cases à cocher, toutes vides', () => {
    setup(false);

    expect(boxes().map((box) => box.type)).toEqual(Array(5).fill('checkbox'));
    expect(boxes().some((box) => box.checked)).toBe(false);
    expect(host.querySelector('.quiz-count')?.textContent).toBe('QCM · 2 questions');
    expect(host.querySelector('.quiz-title')?.textContent).toBe('Processus');
  });

  it('en lecture, coche un choix par un clic sur son texte, sans toucher au cours', () => {
    setup(false);
    const before = editor.getJSON();

    host.querySelectorAll<HTMLElement>('.quiz-choice-text')[1].click();

    expect(boxes()[1].checked).toBe(true);
    expect(editor.getJSON()).toEqual(before);
  });

  it('corrige les réponses à la validation, puis les efface pour recommencer', () => {
    setup(false);
    const [a, , c] = boxes();
    a.click();
    c.click();

    click('.quiz-check');

    const [first, second] = Array.from(host.querySelectorAll('.quiz-question'));
    expect(first.classList.contains('is-right')).toBe(true);
    expect(first.querySelector('.quiz-verdict')?.textContent).toBe('Bonne réponse');
    // Il manquait une des deux bonnes réponses.
    expect(second.classList.contains('is-wrong')).toBe(true);
    expect(second.querySelector('.quiz-verdict')?.textContent).toBe('Mauvaise réponse');
    expect(host.querySelector('.quiz-score')?.textContent).toBe('1 bonne réponse sur 2');
    expect(host.querySelector('.quiz')?.classList.contains('is-checked')).toBe(true);
    expect(boxes().every((box) => box.disabled)).toBe(true);
    expect(
      Array.from(host.querySelectorAll('.quiz-choice.is-expected .quiz-choice-text')).map(
        (found) => found.textContent,
      ),
    ).toEqual(['a', 'c', 'd']);

    click('.quiz-retry');

    expect(boxes().some((box) => box.checked || box.disabled)).toBe(false);
    expect(host.querySelector('.is-checked, .is-right, .is-wrong, .is-expected')).toBeNull();
    expect(host.querySelector('.quiz-score')?.textContent).toBe('');
  });

  it('prévient la page du score à la validation, et de la demande d’historique', () => {
    setup(false);
    const events: { type: string; detail: unknown }[] = [];
    for (const type of ['quizchecked', 'quizhistory']) {
      host.addEventListener(type, (event) =>
        events.push({ type, detail: (event as CustomEvent<unknown>).detail }),
      );
    }
    boxes()[0].click();

    click('.quiz-check');
    click('.quiz-history');

    expect(events).toEqual([
      { type: 'quizchecked', detail: { right: 1, total: 2 } },
      { type: 'quizhistory', detail: null },
    ]);
  });

  it('signale chaque case cochée, pour garder les réponses en cours', () => {
    setup(false);
    const changes: boolean[][][] = [];
    host.addEventListener('quizchanged', (event) =>
      changes.push((event as CustomEvent<boolean[][]>).detail),
    );

    boxes()[0].click();
    boxes()[3].click();

    expect(changes.at(-1)).toEqual([
      [true, false],
      [false, true, false],
    ]);

    click('.quiz-check');
    click('.quiz-retry');
    // « Recommencer » vide les réponses en cours.
    expect(changes.at(-1)).toEqual([
      [false, false],
      [false, false, false],
    ]);
  });

  it('recoche les cases d’un QCM repris, sans toucher à un QCM déjà validé', () => {
    setup(false);
    const quiz = host.querySelector<HTMLElement>('.quiz');
    if (!quiz) {
      throw new Error('QCM absent');
    }

    // Une question de plus que dans le QCM : elle est ignorée.
    applyChecked(quiz, [[false, true], [true], [true]]);
    expect(readChecked(quiz)).toEqual([
      [false, true],
      [true, false, false],
    ]);

    click('.quiz-check');
    applyChecked(quiz, [[true, false], []]);
    expect(readChecked(quiz)[0]).toEqual([false, true]);
  });

  it('signale un choix coché à tort', () => {
    setup(false);
    boxes()[1].click();

    click('.quiz-check');

    expect(host.querySelector('.quiz-choice.is-mistake .quiz-choice-text')?.textContent).toBe('b');
  });

  it('marque l’explication laissée vide, pour ne pas l’afficher en lecture', () => {
    setup(false);

    const explanations = Array.from(host.querySelectorAll('.quiz-explanation'));

    expect(explanations.map((found) => found.classList.contains('is-empty'))).toEqual([
      false,
      true,
    ]);
  });

  it('en édition, la case d’un choix désigne une bonne réponse', () => {
    setup(true);
    expect(boxes().map((box) => box.checked)).toEqual([true, false, true, true, false]);

    boxes()[1].click();

    const choices: boolean[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'quizChoice') {
        choices.push(node.attrs['correct'] === true);
      }
    });
    expect(choices).toEqual([true, true, true, true, false]);
  });

  it('en édition, cocher une bonne réponse ou saisir le titre ne déplace ni le curseur ni la page', () => {
    setup(true);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const before = editor.state.selection.from;
    const field = host.querySelector<HTMLInputElement>('.quiz-title-field');
    let scrolls = 0;
    const dispatch = editor.view.dispatch.bind(editor.view);
    editor.view.dispatch = (transaction) => {
      scrolls += transaction.scrolledIntoView ? 1 : 0;
      dispatch(transaction);
    };

    boxes()[1].click();
    field?.focus();
    if (field) {
      field.value = 'Mémoire';
      field.dispatchEvent(new Event('input'));
    }

    expect(editor.state.selection.from).toBe(before);
    expect(scrolls).toBe(0);
    expect(document.activeElement).toBe(field);
  });

  it('en édition, le titre se saisit dans son champ', () => {
    setup(true);
    const field = host.querySelector<HTMLInputElement>('.quiz-title-field');

    if (field) {
      field.value = 'Mémoire';
      field.dispatchEvent(new Event('input'));
    }

    expect(editor.state.doc.firstChild?.attrs['title']).toBe('Mémoire');
  });
});
