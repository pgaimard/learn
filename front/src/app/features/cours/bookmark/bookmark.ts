import { ContentNode } from '../content/content-node';

// Marque-page de lecture : le titre où l'on s'est arrêté, et le rang de son bloc parmi
// ceux de premier niveau du cours.
export interface Bookmark {
  title: string;
  block: number;
}

function headingText(block: ContentNode): string | null {
  if (block.type !== 'heading') {
    return null;
  }
  return (block.content ?? [])
    .map((child) => child.text ?? '')
    .join('')
    .trim();
}

// Section où se trouve le bloc de ce rang : le dernier titre placé avant lui (ou lui-même).
// Avant le premier titre, c'est le premier titre ; null pour un cours sans titre.
export function sectionAt(document: ContentNode, block: number): Bookmark | null {
  const blocks = document.content ?? [];
  let found: Bookmark | null = null;
  for (let index = 0; index < blocks.length; index++) {
    const title = headingText(blocks[index]);
    if (title === null || title === '') {
      continue;
    }
    if (index > block && found) {
      break;
    }
    found = { title, block: index };
    if (index > block) {
      break;
    }
  }
  return found;
}

// Rang actuel du bloc marqué. Le cours a pu être retouché depuis : le titre est retrouvé
// par son texte, et s'il y figure plusieurs fois, le plus proche de son ancien rang
// l'emporte. null quand ce titre n'existe plus.
export function findBookmarkBlock(document: ContentNode, bookmark: Bookmark | null): number | null {
  if (!bookmark) {
    return null;
  }
  let closest: number | null = null;
  (document.content ?? []).forEach((block, index) => {
    const isNearer =
      closest === null || Math.abs(index - bookmark.block) < Math.abs(closest - bookmark.block);
    if (headingText(block) === bookmark.title && isNearer) {
      closest = index;
    }
  });
  return closest;
}

function countHeadings(node: ContentNode): number {
  if (node.type === 'heading') {
    return 1;
  }
  return (node.content ?? []).reduce((count, child) => count + countHeadings(child), 0);
}

// Rang, parmi tous les titres du document, du titre placé au bloc donné : celui que lui
// donne le sommaire.
export function headingRankOf(document: ContentNode, block: number): number {
  return (document.content ?? [])
    .slice(0, block)
    .reduce((count, node) => count + countHeadings(node), 0);
}

// Titre du sommaire, réduit à ce qui sert ici.
interface RankedHeading {
  index: number;
  level: number;
}

// Le titre lu se trouve-t-il dans le chapitre marqué : le titre marqué lui-même, ou un de
// ceux qui le suivent avant le prochain titre de même niveau ou de niveau supérieur ?
export function isInSection(
  headings: RankedHeading[],
  marked: number,
  read: number | null,
): boolean {
  const start = headings.findIndex((heading) => heading.index === marked);
  if (start < 0 || read === null) {
    return false;
  }
  const level = headings[start].level;
  const next = headings.findIndex(
    (heading, position) => position > start && heading.level <= level,
  );
  const inside = headings.slice(start, next < 0 ? undefined : next);
  return inside.some((heading) => heading.index === read);
}
