import { ContentNode } from './content-node.js';
import { plainText } from './inline-to-markdown.js';

// Section d'un document : un titre du premier niveau du document et ce qui le suit,
// jusqu'au titre suivant de même niveau ou d'un niveau au-dessus.
export interface OutlineSection {
  // Rang du titre parmi ceux du document, à partir de 1 : il désigne la section.
  rank: number;
  level: number;
  title: string;
}

export interface OutlineExercise {
  key: string;
  title: string;
}

function levelOf(block: ContentNode): number {
  return Number(block.attrs?.['level']);
}

function headingIndexes(document: ContentNode): number[] {
  return (document.content ?? []).flatMap((block, index) =>
    block.type === 'heading' ? [index] : [],
  );
}

export function outlineOf(document: ContentNode): OutlineSection[] {
  const blocks = document.content ?? [];
  return headingIndexes(document).map((index, position) => ({
    rank: position + 1,
    level: levelOf(blocks[index]),
    title: plainText(blocks[index]).trim(),
  }));
}

// Blocs de la section de ce rang, sous-sections comprises ; null si le rang n'existe pas.
export function sectionOf(
  document: ContentNode,
  rank: number,
): ContentNode[] | null {
  const blocks = document.content ?? [];
  const start = headingIndexes(document)[rank - 1];
  if (start === undefined) {
    return null;
  }
  const end = blocks.findIndex(
    (block, index) =>
      index > start &&
      block.type === 'heading' &&
      levelOf(block) <= levelOf(blocks[start]),
  );
  return blocks.slice(start, end < 0 ? blocks.length : end);
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// Exercices d'un document, avec la clé à laquelle leurs tentatives sont rattachées.
export function exercisesOf(document: ContentNode): OutlineExercise[] {
  return (document.content ?? [])
    .filter((block) => block.type === 'exercise')
    .map((block) => ({
      key: stringOf(block.attrs?.['key']),
      title: stringOf(block.attrs?.['title']),
    }));
}
