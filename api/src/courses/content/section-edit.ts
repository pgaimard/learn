import { exerciseKey } from '../import/exercise-from-blocks.js';
import { ContentNode, EMPTY_CONTENT } from './content-node.js';
import { sectionRange } from './content-outline.js';
import { plainText } from './inline-to-markdown.js';

// Refus d'une opération sur une section ; son message s'adresse à qui l'a demandée.
export class SectionEditError extends Error {}

const MAX_KEY_LENGTH = 64;

function levelOf(block: ContentNode): number {
  return Number(block.attrs?.['level']);
}

function isHeading(block: ContentNode | undefined): block is ContentNode {
  return block?.type === 'heading';
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function rangeOf(document: ContentNode, id: string): [number, number] {
  const range = sectionRange(document, id);
  if (!range) {
    throw new SectionEditError(
      `Ce document n’a pas de section « ${id} ». Ses sections sont données par get_course_outline.`,
    );
  }
  return [range.start, range.end];
}

function assertStartsWithHeading(blocks: ContentNode[]): void {
  if (!isHeading(blocks[0])) {
    throw new SectionEditError(
      'Une section commence par son titre : la première ligne du Markdown doit être un titre (« ## … » à « ##### … »).',
    );
  }
}

// Une section remplacée garde sa place dans le plan : même niveau de titre, et aucun
// titre de ce niveau ou au-dessus dans son corps, qui ouvrirait une autre section.
function assertSameShape(blocks: ContentNode[], replaced: ContentNode): void {
  const level = levelOf(replaced);
  if (levelOf(blocks[0]) !== level) {
    throw new SectionEditError(
      `La section remplacée a un titre de niveau ${level} : le nouveau texte doit commencer par un titre de ce niveau (${'#'.repeat(level)}).`,
    );
  }
  if (
    blocks.slice(1).some((block) => isHeading(block) && levelOf(block) <= level)
  ) {
    throw new SectionEditError(
      `Le nouveau texte contient un autre titre de niveau ${level} ou au-dessus : il ouvrirait une seconde section. Remplacez une section à la fois, et ajoutez les autres avec insert_section.`,
    );
  }
}

// Le titre de la section garde son identifiant ; un sous-titre garde le sien s'il a
// toujours le même texte. Les autres en recevront un à l'enregistrement.
function keepHeadingIds(
  blocks: ContentNode[],
  replaced: ContentNode[],
): ContentNode[] {
  const available = replaced.slice(1).filter(isHeading);
  return blocks.map((block, index) => {
    if (!isHeading(block)) {
      return block;
    }
    const match =
      index === 0
        ? replaced[0]
        : available.find((old) => plainText(old) === plainText(block));
    if (!match) {
      return block;
    }
    if (index > 0) {
      available.splice(available.indexOf(match), 1);
    }
    return { ...block, attrs: { ...block.attrs, id: match.attrs?.['id'] } };
  });
}

function exercisesIn(blocks: ContentNode[]): ContentNode[] {
  return blocks.filter((block) => block.type === 'exercise');
}

function freeKey(base: string, taken: Set<string>): string {
  let key = base;
  for (let copy = 2; taken.has(key); copy++) {
    const suffix = `-${copy}`;
    key = base.slice(0, MAX_KEY_LENGTH - suffix.length) + suffix;
  }
  return key;
}

// Un exercice dont le titre n'a pas changé garde sa clé, à laquelle ses tentatives sont
// rattachées ; un nouvel exercice en reçoit une que le reste du document n'utilise pas.
function keepExerciseKeys(
  blocks: ContentNode[],
  replaced: ContentNode[],
  others: ContentNode[],
): ContentNode[] {
  const taken = new Set(
    exercisesIn(others).map((exercise) => stringOf(exercise.attrs?.['key'])),
  );
  const previous = new Map(
    exercisesIn(replaced).map((exercise) => [
      stringOf(exercise.attrs?.['title']),
      stringOf(exercise.attrs?.['key']),
    ]),
  );
  let rank = exercisesIn(others).length;
  return blocks.map((block) => {
    if (block.type !== 'exercise') {
      return block;
    }
    rank += 1;
    const title = stringOf(block.attrs?.['title']);
    const kept = previous.get(title);
    const key =
      kept && !taken.has(kept)
        ? kept
        : freeKey(exerciseKey(title, rank), taken);
    taken.add(key);
    return { ...block, attrs: { ...block.attrs, key } };
  });
}

function withBlocks(document: ContentNode, blocks: ContentNode[]): ContentNode {
  return {
    ...document,
    content: blocks.length > 0 ? blocks : EMPTY_CONTENT.content,
  };
}

// Remplace la section de ce titre, sous-sections comprises, par ces blocs. Le reste du
// document est rendu tel quel.
export function replaceSection(
  document: ContentNode,
  id: string,
  blocks: ContentNode[],
): ContentNode {
  const all = document.content ?? [];
  const [start, end] = rangeOf(document, id);
  const replaced = all.slice(start, end);
  const others = [...all.slice(0, start), ...all.slice(end)];
  assertStartsWithHeading(blocks);
  assertSameShape(blocks, replaced[0]);
  const section = keepExerciseKeys(
    keepHeadingIds(blocks, replaced),
    replaced,
    others,
  );
  return withBlocks(document, [
    ...all.slice(0, start),
    ...section,
    ...all.slice(end),
  ]);
}

// Insère ces blocs après la section indiquée, ou à la fin du document.
export function insertSection(
  document: ContentNode,
  blocks: ContentNode[],
  afterId?: string,
): ContentNode {
  const all = (document.content ?? []).filter(
    (block, index, list) =>
      // Le paragraphe vide d'un document vierge ne reste pas devant la section.
      list.length > 1 || block.type !== 'paragraph' || block.content?.length,
  );
  const at =
    afterId === undefined
      ? all.length
      : rangeOf({ ...document, content: all }, afterId)[1];
  assertStartsWithHeading(blocks);
  const section = keepExerciseKeys(blocks, [], all);
  return withBlocks(document, [
    ...all.slice(0, at),
    ...section,
    ...all.slice(at),
  ]);
}

// Supprime la section de ce titre, sous-sections comprises.
export function deleteSection(document: ContentNode, id: string): ContentNode {
  const all = document.content ?? [];
  const [start, end] = rangeOf(document, id);
  return withBlocks(document, [...all.slice(0, start), ...all.slice(end)]);
}
