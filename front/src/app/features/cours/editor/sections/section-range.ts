import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { blockAt } from '../blocks/block-commands';

// Chapitre : un titre de premier niveau du document et tout ce qui le suit jusqu'au
// prochain titre de même niveau ou de niveau supérieur.
export interface Section {
  // Position du titre.
  from: number;
  // Position où commence le contenu, juste après le titre.
  bodyFrom: number;
  // Position de fin, exclue.
  to: number;
  level: number;
  // Rang du titre parmi les blocs du document, et rang du premier bloc hors du chapitre.
  index: number;
  endIndex: number;
}

export function headingLevel(node: ProseMirrorNode): number | null {
  const level: unknown = node.attrs['level'];
  return node.type.name === 'heading' && typeof level === 'number' ? level : null;
}

// Chapitre dont le titre se trouve à la position donnée ; null si ce n'est pas un titre.
export function sectionAt(doc: ProseMirrorNode, headingPos: number): Section | null {
  const block = blockAt(doc, headingPos);
  const level = block && block.pos === headingPos ? headingLevel(block.node) : null;
  if (!block || level === null) {
    return null;
  }
  let to = block.pos + block.node.nodeSize;
  let endIndex = block.index + 1;
  while (endIndex < doc.childCount) {
    const next = doc.child(endIndex);
    const nextLevel = headingLevel(next);
    if (nextLevel !== null && nextLevel <= level) {
      break;
    }
    to += next.nodeSize;
    endIndex += 1;
  }
  return {
    from: block.pos,
    bodyFrom: block.pos + block.node.nodeSize,
    to,
    level,
    index: block.index,
    endIndex,
  };
}

// Chapitre voisin de même niveau, sous le même parent : le précédent (-1) ou le suivant (1).
export function siblingSection(
  doc: ProseMirrorNode,
  section: Section,
  direction: -1 | 1,
): Section | null {
  if (direction === 1) {
    const next = section.endIndex < doc.childCount ? doc.child(section.endIndex) : null;
    return next && headingLevel(next) === section.level ? sectionAt(doc, section.to) : null;
  }
  let pos = section.from;
  for (let index = section.index - 1; index >= 0; index--) {
    const node = doc.child(index);
    pos -= node.nodeSize;
    const level = headingLevel(node);
    if (level !== null && level < section.level) {
      return null;
    }
    if (level === section.level) {
      return sectionAt(doc, pos);
    }
  }
  return null;
}
