import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateContent } from '../content/validate-content.js';
import { markdownToContent } from './markdown-to-content.js';

const QUIZ = [
  '> [!qcm] Autour des processus',
  '>',
  '> 1. Un processus est :',
  '>    - [x] la **dynamique** de son exécution',
  '>    - [ ] un programme exécutable',
  '>    - [ ] un logiciel',
  '>',
  '>    Un programme n’est que du code rangé sur disque.',
  '>',
  '> 2. Que fait ce code ?',
  '>',
  '>    ```c',
  '>    fork();',
  '>    ```',
  '>',
  '>    - [X] il crée un processus',
  '>    - [x] il duplique l’appelant',
  '>    - [ ] il charge un programme',
].join('\n');

function texts(node: { content?: { text?: string }[] }): string {
  return (node.content ?? []).map((inline) => inline.text ?? '').join('');
}

describe('QCM dans le Markdown', () => {
  it('fait une question de chaque élément numéroté, avec ses choix et son explication', () => {
    const { document, errors } = markdownToContent(QUIZ, 0);

    expect(errors).toEqual([]);
    expect(validateContent(document)).toEqual([]);
    const quiz = document.content?.[0];
    expect(quiz).toMatchObject({
      type: 'quiz',
      attrs: { title: 'Autour des processus' },
    });
    const [first, second] = quiz?.content ?? [];
    expect(first.content?.map((child) => child.type)).toEqual([
      'quizPrompt',
      'quizChoice',
      'quizChoice',
      'quizChoice',
      'quizExplanation',
    ]);
    expect(first.content?.slice(1, 4).map((choice) => choice.attrs)).toEqual([
      { correct: true },
      { correct: false },
      { correct: false },
    ]);
    expect(texts(first.content?.[1] ?? {})).toBe(
      'la dynamique de son exécution',
    );
    expect(first.content?.[4].content?.[0]).toMatchObject({
      type: 'paragraph',
      content: [{ text: 'Un programme n’est que du code rangé sur disque.' }],
    });
    expect(second.content?.[0].content?.map((block) => block.type)).toEqual([
      'paragraph',
      'codeBlock',
    ]);
    expect(
      second.content?.filter((child) => child.attrs?.['correct'] === true),
    ).toHaveLength(2);
    // Sans explication écrite, la question en reçoit une vide, à remplir dans l'éditeur.
    expect(second.content?.at(-1)).toEqual({
      type: 'quizExplanation',
      content: [{ type: 'paragraph' }],
    });
  });

  it('accepte un QCM sans titre', () => {
    const { document, errors } = markdownToContent(
      '> [!qcm]\n>\n> 1. Vrai ?\n>    - [x] oui\n>    - [ ] non',
      0,
    );

    expect(errors).toEqual([]);
    expect(document.content?.[0].attrs).toEqual({ title: '' });
  });

  it.each([
    [
      'du texte au lieu de questions',
      '> [!qcm]\n>\n> Texte.',
      /liste numérotée/,
    ],
    ['aucune question', '> [!qcm] Titre', /liste numérotée/],
    [
      'une question sans choix',
      '> [!qcm]\n>\n> 1. Vrai ?\n>    - oui\n>    - non',
      /liste de choix/,
    ],
    [
      'un seul choix',
      '> [!qcm]\n>\n> 1. Vrai ?\n>    - [x] oui',
      /de 2 à 10 choix/,
    ],
    [
      'aucune bonne réponse',
      '> [!qcm]\n>\n> 1. Vrai ?\n>    - [ ] oui\n>    - [ ] non',
      /au moins une bonne réponse/,
    ],
    [
      'un choix vide',
      '> [!qcm]\n>\n> 1. Vrai ?\n>    - [x] oui\n>    - [ ]',
      /choix de QCM est vide/,
    ],
    [
      'des choix sans énoncé',
      '> [!qcm]\n>\n> 1. - [x] oui\n>    - [ ] non',
      /énoncé d’une question/,
    ],
    [
      'un tableau dans l’explication',
      '> [!qcm]\n>\n> 1. Vrai ?\n>    - [x] oui\n>    - [ ] non\n>\n>    | a |\n>    |---|\n>    | b |',
      /explication d’une question/,
    ],
  ])('refuse %s', (_case, markdown, message) => {
    const { errors } = markdownToContent(markdown, 0);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });

  it('lit l’exemple de QCM du contrat du paquet', () => {
    const readme = readFileSync(
      join(import.meta.dirname, '../../../../contracts/README.md'),
      'utf8',
    );
    const example =
      /```markdown\n(> \[!qcm\][\s\S]*?)```/.exec(readme)?.[1] ?? '';

    const { document, errors } = markdownToContent(example, 0);

    expect(errors).toEqual([]);
    expect(validateContent(document)).toEqual([]);
    expect(document.content?.[0].content).toHaveLength(2);
  });
});
