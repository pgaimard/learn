import { Editor } from '@tiptap/core';
import { EditorState, TextSelection, Transaction } from '@tiptap/pm/state';
import { blockAt, canMoveBlock, moveBlock } from '../blocks/block-commands';
import { isFolded, keepFolded } from './section-folding';
import { headingLevel, Section, sectionAt, siblingSection } from './section-range';

const MIN_LEVEL = 2;
const MAX_LEVEL = 5;

// Positions des titres repliés d'un chapitre, relatives au début du chapitre.
function foldedOffsets(state: EditorState, section: Section): number[] {
  const offsets: number[] = [];
  state.doc.nodesBetween(section.from, section.to, (node, pos) => {
    if (headingLevel(node) !== null && isFolded(state, pos)) {
      offsets.push(pos - section.from);
    }
    return false;
  });
  return offsets;
}

// Un titre se déplace avec son chapitre, par-dessus le chapitre voisin de même niveau ;
// tout autre bloc se déplace seul.
export function canMoveUnit(editor: Editor, pos: number, direction: -1 | 1): boolean {
  const section = sectionAt(editor.state.doc, pos);
  return section
    ? siblingSection(editor.state.doc, section, direction) !== null
    : canMoveBlock(editor, pos, direction);
}

export function moveUnit(editor: Editor, pos: number, direction: -1 | 1): boolean {
  const { state } = editor;
  const section = sectionAt(state.doc, blockAt(state.doc, pos)?.pos ?? -1);
  if (!section) {
    return moveBlock(editor, pos, direction);
  }
  const sibling = siblingSection(state.doc, section, direction);
  if (!sibling) {
    return false;
  }
  const [first, second] = direction === 1 ? [section, sibling] : [sibling, section];
  // Les deux chapitres échangent leur place : le second passe devant le premier.
  const secondSize = second.to - second.from;
  const moved = direction === 1 ? first.from + secondSize : first.from;
  const other = direction === 1 ? first.from : first.from + (section.to - section.from);
  const folded = [
    ...foldedOffsets(state, section).map((offset) => moved + offset),
    ...foldedOffsets(state, sibling).map((offset) => other + offset),
  ];
  const transaction = state.tr.replaceWith(
    first.from,
    second.to,
    state.doc
      .slice(second.from, second.to)
      .content.append(state.doc.slice(first.from, first.to).content),
  );
  transaction.setSelection(TextSelection.create(transaction.doc, moved + 1));
  editor.view.dispatch(keepFolded(transaction, folded).scrollIntoView());
  return true;
}

// Dépose un chapitre entre deux blocs de premier niveau, au plus près de la position visée.
// Renvoie null si le dépôt tombe dans le chapitre lui-même.
export function dropSection(
  state: EditorState,
  section: Section,
  aimedPos: number,
): Transaction | null {
  const block = blockAt(state.doc, aimedPos);
  const middle = block ? block.pos + block.node.nodeSize / 2 : 0;
  const boundary = !block
    ? state.doc.content.size
    : aimedPos < middle
      ? block.pos
      : block.pos + block.node.nodeSize;
  if (boundary >= section.from && boundary <= section.to) {
    return null;
  }
  const folded = foldedOffsets(state, section);
  const content = state.doc.slice(section.from, section.to).content;
  const transaction = state.tr.delete(section.from, section.to);
  const target = transaction.mapping.map(boundary);
  transaction.insert(target, content);
  transaction.setSelection(TextSelection.create(transaction.doc, target + 1));
  return keepFolded(
    transaction,
    folded.map((offset) => target + offset),
  );
}

function shiftedLevels(state: EditorState, pos: number, delta: -1 | 1): Map<number, number> | null {
  const section = sectionAt(state.doc, pos);
  if (!section) {
    return null;
  }
  const levels = new Map<number, number>();
  let isValid = true;
  state.doc.nodesBetween(section.from, section.to, (node, nodePos) => {
    const level = headingLevel(node);
    if (level !== null) {
      levels.set(nodePos, level + delta);
      isValid &&= level + delta >= MIN_LEVEL && level + delta <= MAX_LEVEL;
    }
    return false;
  });
  return isValid ? levels : null;
}

// Un chapitre change de niveau avec ses sous-titres ; c'est refusé si l'un d'eux
// devait sortir des niveaux existants.
export function canShiftSectionLevel(editor: Editor, pos: number, delta: -1 | 1): boolean {
  return shiftedLevels(editor.state, pos, delta) !== null;
}

// delta -1 : un niveau plus haut (« sous-section » devient « section ») ; 1 : un niveau plus bas.
export function shiftSectionLevel(editor: Editor, pos: number, delta: -1 | 1): boolean {
  const levels = shiftedLevels(editor.state, pos, delta);
  if (!levels) {
    return false;
  }
  const transaction = editor.state.tr;
  for (const [headingPos, level] of levels) {
    transaction.setNodeAttribute(headingPos, 'level', level);
  }
  editor.view.dispatch(transaction);
  return true;
}
