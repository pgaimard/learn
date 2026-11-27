import { ContentNode } from '../content/content-node.js';
import { EXERCISE_BLOCKS } from '../content/content-schema.js';

type Fail = (message: string) => void;

const MAX_KEY_LENGTH = 64;

// Clé d'un exercice, tirée de son titre : minuscules sans accent, chiffres et tirets. Deux
// imports du même cours donnent la même clé au même exercice tant que son titre ne change pas.
export function exerciseKey(title: string, rank: number): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : `exercice-${rank}`;
}

function areAllowed(blocks: ContentNode[]): boolean {
  return blocks.every((block) => EXERCISE_BLOCKS.includes(block.type));
}

// Exercice écrit comme un encadré : son énoncé, puis son corrigé dans un encadré
// « [!corrige] » imbriqué à la fin. Sa clé est posée ensuite, pour tout le document.
export function exerciseFromBlocks(
  title: string,
  blocks: ContentNode[],
  fail: Fail,
): ContentNode {
  const last = blocks.at(-1);
  const hasSolution = last?.type === 'exerciseSolution';
  const statement = hasSolution ? blocks.slice(0, -1) : blocks;
  if (statement.length === 0) {
    fail('exercice sans énoncé.');
  } else if (!areAllowed(statement)) {
    fail(
      'l’énoncé d’un exercice ne contient ni titre, ni diaporama, ni QCM, ni autre exercice ; son corrigé « [!corrige] » vient en dernier.',
    );
  }
  return {
    type: 'exercise',
    attrs: { title, key: '' },
    content: [
      { type: 'exerciseStatement', content: statement },
      // Un exercice a toujours un corrigé, fût-il vide : c'est là qu'on le saisit ensuite.
      hasSolution
        ? last
        : { type: 'exerciseSolution', content: [{ type: 'paragraph' }] },
    ],
  };
}

// Corrigé d'un exercice : l'encadré « [!corrige] », qui n'a de sens que dans un exercice.
export function solutionFromBlocks(
  blocks: ContentNode[],
  fail: Fail,
): ContentNode {
  if (blocks.length === 0) {
    fail('corrigé vide.');
  } else if (!areAllowed(blocks)) {
    fail(
      'le corrigé d’un exercice ne contient ni titre, ni diaporama, ni QCM, ni autre exercice.',
    );
  }
  return { type: 'exerciseSolution', content: blocks };
}

// Donne sa clé à chaque exercice du document ; deux exercices de même titre sont numérotés.
export function keyExercises(blocks: ContentNode[]): void {
  const taken = new Set<string>();
  let rank = 0;
  for (const block of blocks) {
    if (block.type !== 'exercise') {
      continue;
    }
    rank += 1;
    const title: unknown = block.attrs?.['title'];
    const base = exerciseKey(typeof title === 'string' ? title : '', rank);
    let key = base;
    for (let copy = 2; taken.has(key); copy++) {
      const suffix = `-${copy}`;
      key = base.slice(0, MAX_KEY_LENGTH - suffix.length) + suffix;
    }
    taken.add(key);
    block.attrs = { ...block.attrs, key };
  }
}
