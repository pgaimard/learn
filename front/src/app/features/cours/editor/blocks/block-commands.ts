import { Editor } from '@tiptap/core';
import { Fragment, Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import { EditorState, NodeSelection, TextSelection, Transaction } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import { CalloutKind } from '../../content/callout';

// Types en lesquels un bloc de texte (paragraphe ou titre) peut être transformé.
export type BlockTransform =
  | { kind: 'paragraph' }
  | { kind: 'heading'; level: 2 | 3 | 4 | 5 }
  | { kind: 'bulletList' }
  | { kind: 'orderedList' }
  | { kind: 'blockquote' }
  | { kind: 'codeBlock' }
  | { kind: 'callout'; callout: CalloutKind };

// Bloc de premier niveau du document : sa position, son rang et son nœud.
export interface TopLevelBlock {
  pos: number;
  index: number;
  node: ProseMirrorNode;
}

// Bloc de premier niveau qui contient la position donnée (ou qui la suit immédiatement).
export function blockAt(doc: ProseMirrorNode, pos: number): TopLevelBlock | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  const index = $pos.index(0);
  if (index >= doc.childCount) {
    return null;
  }
  return { pos: $pos.posAtIndex(index, 0), index, node: doc.child(index) };
}

export function canMoveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean {
  const block = blockAt(editor.state.doc, pos);
  const target = block ? block.index + direction : -1;
  return target >= 0 && target < editor.state.doc.childCount;
}

// Échange le bloc avec son voisin du dessus (-1) ou du dessous (1) et garde le curseur dedans.
export function moveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean {
  const { doc } = editor.state;
  const block = blockAt(doc, pos);
  if (!block || !canMoveBlock(editor, pos, direction)) {
    return false;
  }
  const neighbour = doc.child(block.index + direction);
  const target = direction === -1 ? block.pos - neighbour.nodeSize : block.pos + neighbour.nodeSize;
  const offset = Math.max(0, editor.state.selection.from - block.pos);
  const transaction = editor.state.tr
    .delete(block.pos, block.pos + block.node.nodeSize)
    .insert(target, block.node);
  selectInside(transaction, target, Math.min(offset, block.node.nodeSize - 1));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

// Déplace un bloc de premier niveau à l'endroit du dépôt le plus proche de la position
// visée où il peut entrer (entre deux blocs, ou dans un encadré, une cellule…).
// Renvoie null si le dépôt n'a pas lieu d'être : dans le bloc lui-même, ou sans place.
export function dropBlock(
  state: EditorState,
  source: TopLevelBlock,
  aimedPos: number,
): Transaction | null {
  const slice = new Slice(Fragment.from(source.node), 0, 0);
  const insertPos = dropPoint(state.doc, aimedPos, slice) ?? aimedPos;
  const sourceEnd = source.pos + source.node.nodeSize;
  if (insertPos >= source.pos && insertPos <= sourceEnd) {
    return null;
  }
  const transaction = state.tr.delete(source.pos, sourceEnd);
  const target = transaction.mapping.map(insertPos);
  try {
    transaction.insert(target, source.node);
  } catch {
    // Position qui n'accepte pas ce bloc : le document reste tel quel.
    return null;
  }
  // Le curseur suit le bloc ; sélectionner un tableau entier sélectionnerait ses cellules.
  selectInside(transaction, target, 1);
  return transaction;
}

export function duplicateBlock(editor: Editor, pos: number): boolean {
  const block = blockAt(editor.state.doc, pos);
  if (!block) {
    return false;
  }
  const copyPos = block.pos + block.node.nodeSize;
  const transaction = editor.state.tr.insert(copyPos, block.node.copy(block.node.content));
  selectInside(transaction, copyPos, 1);
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

export function deleteBlock(editor: Editor, pos: number): boolean {
  const block = blockAt(editor.state.doc, pos);
  if (!block) {
    return false;
  }
  // Le document garde toujours au moins un bloc : ProseMirror le recrée s'il le faut.
  editor.view.dispatch(editor.state.tr.delete(block.pos, block.pos + block.node.nodeSize));
  return true;
}

// Seuls un paragraphe ou un titre se transforment : les autres blocs ont une structure propre.
export function canTransformBlock(editor: Editor, pos: number): boolean {
  const name = blockAt(editor.state.doc, pos)?.node.type.name;
  return name === 'paragraph' || name === 'heading';
}

export function transformBlock(editor: Editor, pos: number, transform: BlockTransform): boolean {
  const block = blockAt(editor.state.doc, pos);
  if (!block || !canTransformBlock(editor, pos)) {
    return false;
  }
  const chain = editor
    .chain()
    .focus()
    .setTextSelection(block.pos + 1);
  switch (transform.kind) {
    case 'paragraph':
      return chain.setParagraph().run();
    case 'heading':
      return chain.setHeading({ level: transform.level }).run();
    case 'bulletList':
      return chain.setParagraph().toggleBulletList().run();
    case 'orderedList':
      return chain.setParagraph().toggleOrderedList().run();
    case 'blockquote':
      return chain.setParagraph().setBlockquote().run();
    case 'codeBlock':
      return chain.setCodeBlock().run();
    case 'callout':
      return chain.setParagraph().wrapIn('callout', { kind: transform.callout }).run();
  }
}

// Place le curseur dans le bloc situé à blockPos, ou le sélectionne s'il n'a pas de texte.
function selectInside(transaction: Transaction, blockPos: number, offset: number): void {
  const $pos = transaction.doc.resolve(blockPos + Math.max(1, offset));
  const selection = TextSelection.findFrom($pos, 1, true) ?? TextSelection.findFrom($pos, -1, true);
  const inBlock = selection && blockAt(transaction.doc, selection.from)?.pos === blockPos;
  transaction.setSelection(
    inBlock && selection ? selection : NodeSelection.create(transaction.doc, blockPos),
  );
}
