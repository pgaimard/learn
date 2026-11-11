import { ContentNode } from '../content/content-node';

// Ce qu'il faut connaître d'un bloc pour décider s'il est dans la fiche de révision.
export interface SheetBlock {
  type: string;
  attrs?: Record<string, unknown> | null;
}

function headingLevel(block: SheetBlock): number | null {
  const level: unknown = block.attrs?.['level'];
  return block.type === 'heading' && typeof level === 'number' ? level : null;
}

// Un bloc entre dans la fiche s'il est épinglé ou si c'est un encadré « À retenir ».
function isKeptContent(block: SheetBlock): boolean {
  return (
    block.attrs?.['pinned'] === true ||
    (block.type === 'callout' && block.attrs?.['kind'] === 'retenir')
  );
}

// Pour chaque bloc de premier niveau du cours, dit s'il figure dans la fiche de révision :
// les blocs gardés, et les titres dont le chapitre contient au moins un bloc gardé. La
// structure du cours reste ainsi lisible, sans titre qui ne mène à rien.
export function sheetBlocks(blocks: readonly SheetBlock[]): boolean[] {
  return blocks.map((block, index) => {
    const level = headingLevel(block);
    if (level === null) {
      return isKeptContent(block);
    }
    for (let next = index + 1; next < blocks.length; next++) {
      const nextLevel = headingLevel(blocks[next]);
      if (nextLevel !== null && nextLevel <= level) {
        return false;
      }
      if (nextLevel === null && isKeptContent(blocks[next])) {
        return true;
      }
    }
    return false;
  });
}

function countHeadings(node: ContentNode): number {
  if (node.type === 'heading') {
    return 1;
  }
  return (node.content ?? []).reduce((count, child) => count + countHeadings(child), 0);
}

// Rangs, parmi tous les titres du document, de ceux que la fiche affiche : ils servent à
// réduire le sommaire à la fiche.
export function sheetHeadingIndexes(document: ContentNode): Set<number> {
  const blocks = document.content ?? [];
  const kept = sheetBlocks(blocks);
  const indexes = new Set<number>();
  let rank = 0;
  blocks.forEach((block, index) => {
    // Un titre compte pour lui-même ; un autre bloc, pour les titres qu'il contient.
    const count = countHeadings(block);
    if (kept[index]) {
      for (let offset = 0; offset < count; offset++) {
        indexes.add(rank + offset);
      }
    }
    rank += count;
  });
  return indexes;
}

// La fiche a-t-elle quelque chose à montrer ?
export function hasSheetContent(document: ContentNode): boolean {
  return sheetBlocks(document.content ?? []).some(Boolean);
}
