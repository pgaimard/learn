import { ContentNode } from './content-node.js';
import {
  keepExerciseKeys,
  keepHeadingIds,
  SectionEditError,
  withBlocks,
  writtenBlocks,
} from './section-edit.js';

const EXERCISE_TYPES = ['exercise', 'quiz'];

// Pose ces blocs comme document entier, à la place de l'ancien. Un titre de même texte
// garde son identifiant, un exercice de même titre garde sa clé.
export function setDocument(
  previous: ContentNode,
  blocks: ContentNode[],
): ContentNode {
  const old = previous.content ?? [];
  return withBlocks(
    previous,
    keepExerciseKeys(keepHeadingIds(blocks, old), old, []),
  );
}

// Ajoute ces QCM et ces exercices à la fin du document. Les QCM déjà là gardent leur rang,
// auquel leurs réponses sont rattachées.
export function appendExercises(
  document: ContentNode,
  blocks: ContentNode[],
): ContentNode {
  if (
    blocks.length === 0 ||
    blocks.some((block) => !EXERCISE_TYPES.includes(block.type))
  ) {
    throw new SectionEditError(
      'Le Markdown ne doit contenir que des QCM (« > [!qcm] Titre ») et des exercices (« > [!exercice] Titre »). Une section avec son titre s’ajoute par insert_section.',
    );
  }
  const all = writtenBlocks(document);
  return withBlocks(document, [...all, ...keepExerciseKeys(blocks, [], all)]);
}

// Remplace le corrigé de l'exercice de cette clé ; son énoncé n'est pas touché.
export function setExerciseSolution(
  document: ContentNode,
  key: string,
  solution: ContentNode,
): ContentNode {
  const blocks = document.content ?? [];
  const index = blocks.findIndex(
    (block) => block.type === 'exercise' && block.attrs?.['key'] === key,
  );
  if (index < 0) {
    throw new SectionEditError(
      `Ce cours n’a pas d’exercice « ${key} ». Les clés des exercices sont données par get_course_outline.`,
    );
  }
  const exercise = blocks[index];
  const statement = (exercise.content ?? []).filter(
    (part) => part.type !== 'exerciseSolution',
  );
  return withBlocks(document, [
    ...blocks.slice(0, index),
    { ...exercise, content: [...statement, solution] },
    ...blocks.slice(index + 1),
  ]);
}
