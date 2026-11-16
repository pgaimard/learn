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
