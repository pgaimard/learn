import { ContentNode } from './content-node.js';
import { plainText } from './inline-to-markdown.js';

// Section d'un document : un titre du premier niveau du document et ce qui le suit,
// jusqu'au titre suivant de même niveau ou d'un niveau au-dessus.
export interface OutlineSection {
  // Identifiant du titre : il désigne la section, et ne change pas si on la renomme.
  id: string;
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

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function idOf(block: ContentNode): string {
  return stringOf(block.attrs?.['id']);
}

function describe(block: ContentNode): OutlineSection {
  return {
    id: idOf(block),
    level: levelOf(block),
    title: plainText(block).trim(),
  };
}

export function outlineOf(document: ContentNode): OutlineSection[] {
  return (document.content ?? [])
    .filter((block) => block.type === 'heading')
    .map(describe);
}

// Place d'une section dans les blocs du document : son titre, et le bloc qui suit sa fin.
export interface SectionRange {
  start: number;
  end: number;
}

export function sectionRange(
  document: ContentNode,
  id: string,
): SectionRange | null {
  const blocks = document.content ?? [];
  const start = blocks.findIndex(
    (block) => block.type === 'heading' && id !== '' && idOf(block) === id,
  );
  if (start < 0) {
    return null;
  }
  const end = blocks.findIndex(
    (block, index) =>
      index > start &&
      block.type === 'heading' &&
      levelOf(block) <= levelOf(blocks[start]),
  );
  return { start, end: end < 0 ? blocks.length : end };
}

// Blocs de la section de ce titre, sous-sections comprises ; null s'il n'existe pas.
export function sectionOf(
  document: ContentNode,
  id: string,
): ContentNode[] | null {
  const range = sectionRange(document, id);
  return range && (document.content ?? []).slice(range.start, range.end);
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
