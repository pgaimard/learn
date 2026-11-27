import { ContentNode } from '../content/content-node.js';
import {
  MAX_QUIZ_CHOICES,
  MAX_QUIZ_QUESTIONS,
  QUIZ_EXPLANATION,
} from '../content/content-schema.js';

// Case d'un choix, en tête de son texte : « [x] » pour une bonne réponse, « [ ] » sinon.
const CHOICE_MARKER = /^\[( |x|X)\](\s+|$)/;
const PROMPT_BLOCKS = [
  'paragraph',
  'bulletList',
  'orderedList',
  'codeBlock',
  'figure',
];

type Fail = (message: string) => void;

// Choix écrit dans cet élément de liste ; null si l'élément n'en est pas un.
function choiceOf(item: ContentNode): ContentNode | null {
  const [paragraph, ...others] = item.content ?? [];
  const [first, ...inline] = paragraph?.content ?? [];
  const marker = CHOICE_MARKER.exec(first?.text ?? '');
  if (others.length > 0 || paragraph?.type !== 'paragraph' || !marker) {
    return null;
  }
  const text = (first.text ?? '').slice(marker[0].length);
  const content = text.length > 0 ? [{ ...first, text }, ...inline] : inline;
  return {
    type: 'quizChoice',
    attrs: { correct: marker[1] !== ' ' },
    ...(content.length > 0 ? { content } : {}),
  };
}

// Choix d'une liste à puces dont chaque élément porte une case ; null pour une autre liste.
function choicesOf(block: ContentNode): ContentNode[] | null {
  if (block.type !== 'bulletList') {
    return null;
  }
  const choices = (block.content ?? []).map(choiceOf);
  return choices.every((choice) => choice !== null) ? choices : null;
}

function areAll(blocks: ContentNode[], types: string[]): boolean {
  return blocks.every((block) => types.includes(block.type));
}

function checkChoices(choices: ContentNode[], fail: Fail): void {
  if (choices.length < 2 || choices.length > MAX_QUIZ_CHOICES) {
    fail(`une question de QCM a de 2 à ${MAX_QUIZ_CHOICES} choix.`);
  }
  if (choices.some((choice) => choice.content === undefined)) {
    fail('un choix de QCM est vide.');
  }
  if (!choices.some((choice) => choice.attrs?.['correct'] === true)) {
    fail('une question de QCM a au moins une bonne réponse, cochée « [x] ».');
  }
}

// Question écrite dans cet élément de liste : son énoncé, la liste de ses choix, puis
// son explication.
function questionOf(item: ContentNode, fail: Fail): ContentNode {
  const blocks = item.content ?? [];
  const at = blocks.findIndex((block) => choicesOf(block) !== null);
  const choices = at < 0 ? [] : (choicesOf(blocks[at]) ?? []);
  const prompt = at < 0 ? blocks : blocks.slice(0, at);
  const explanation = at < 0 ? [] : blocks.slice(at + 1);
  if (at < 0) {
    fail(
      'chaque question de QCM a une liste de choix, chacun précédé de « [x] » ou « [ ] ».',
    );
  } else {
    checkChoices(choices, fail);
  }
  if (prompt.length === 0 || !areAll(prompt, PROMPT_BLOCKS)) {
    fail(
      'l’énoncé d’une question de QCM se compose de paragraphes, de listes, de code ou d’images, avant ses choix.',
    );
  }
  if (!areAll(explanation, QUIZ_EXPLANATION)) {
    fail(
      'l’explication d’une question de QCM ne contient ni titre, ni diaporama, ni QCM.',
    );
  }
  return {
    type: 'quizQuestion',
    content: [
      { type: 'quizPrompt', content: prompt },
      ...choices,
      // Une question a toujours une explication, fût-elle vide : c'est là qu'on la saisit.
      {
        type: 'quizExplanation',
        content: explanation.length > 0 ? explanation : [{ type: 'paragraph' }],
      },
    ],
  };
}

// QCM écrit comme un encadré : une liste numérotée dont chaque élément est une question.
export function quizFromBlocks(
  title: string,
  blocks: ContentNode[],
  fail: Fail,
): ContentNode {
  if (blocks.length === 0 || !areAll(blocks, ['orderedList'])) {
    fail('un QCM est une liste numérotée de questions.');
    return { type: 'quiz', attrs: { title }, content: [] };
  }
  const items = blocks.flatMap((list) => list.content ?? []);
  if (items.length > MAX_QUIZ_QUESTIONS) {
    fail(
      `un QCM compte ${MAX_QUIZ_QUESTIONS} questions au plus (${items.length} ici).`,
    );
  }
  return {
    type: 'quiz',
    attrs: { title },
    content: items.map((item) => questionOf(item, fail)),
  };
}
