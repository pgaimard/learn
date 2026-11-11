import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey, TextSelection, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { sectionAt } from './section-range';

// Changement d'état demandé par une transaction : basculer un chapitre, en replier
// d'autres (après un déplacement), ou déplier tout ce qui cache une position.
interface FoldingChange {
  toggle?: number;
  add?: number[];
  reveal?: number;
}

// Positions des titres dont le chapitre est replié. C'est un état d'affichage :
// il n'est pas enregistré avec le contenu.
export const foldingKey = new PluginKey<number[]>('sectionFolding');

export function isFolded(state: EditorState, headingPos: number): boolean {
  return (foldingKey.getState(state) ?? []).includes(headingPos);
}

// À poser sur une transaction qui déplace des chapitres repliés : ils le restent.
export function keepFolded(transaction: Transaction, headingPositions: number[]): Transaction {
  return transaction.setMeta(foldingKey, { add: headingPositions } satisfies FoldingChange);
}

export function toggleFold(view: EditorView, headingPos: number): void {
  const { state } = view;
  const section = sectionAt(state.doc, headingPos);
  if (!section) {
    return;
  }
  const transaction = state.tr.setMeta(foldingKey, { toggle: headingPos } satisfies FoldingChange);
  const { from } = state.selection;
  // Le curseur ne reste pas dans un texte qui vient d'être caché.
  if (!isFolded(state, headingPos) && from > section.bodyFrom && from < section.to) {
    transaction.setSelection(TextSelection.create(state.doc, section.bodyFrom - 1));
  }
  view.dispatch(transaction);
}

// Déplie les chapitres qui cachent la position donnée (titre atteint par le sommaire).
export function revealPosition(view: EditorView, pos: number): void {
  view.dispatch(view.state.tr.setMeta(foldingKey, { reveal: pos } satisfies FoldingChange));
}

function isTopLevelHeading(doc: ProseMirrorNode, pos: number): boolean {
  return (
    pos < doc.content.size &&
    doc.resolve(pos).depth === 0 &&
    doc.nodeAt(pos)?.type.name === 'heading'
  );
}

function applyChange(folded: number[], change: FoldingChange, doc: ProseMirrorNode): number[] {
  let next = folded;
  if (change.toggle !== undefined) {
    const pos = change.toggle;
    next = next.includes(pos) ? next.filter((other) => other !== pos) : [...next, pos];
  }
  if (change.add) {
    next = [...new Set([...next, ...change.add])];
  }
  if (change.reveal !== undefined) {
    const target = change.reveal;
    next = next.filter((pos) => {
      const section = sectionAt(doc, pos);
      return !section || target < section.bodyFrom || target >= section.to;
    });
  }
  return next.filter((pos) => isTopLevelHeading(doc, pos));
}

function createToggle(
  view: EditorView,
  getPos: () => number | undefined,
  folded: boolean,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fold-toggle';
  button.contentEditable = 'false';
  // En édition, le bouton ne doit pas interrompre la tabulation dans le texte.
  button.tabIndex = view.editable ? -1 : 0;
  button.setAttribute('aria-expanded', String(!folded));
  button.setAttribute('aria-label', folded ? 'Déplier le chapitre' : 'Replier le chapitre');
  button.title = folded ? 'Déplier' : 'Replier';
  // Le chevron est dessiné par la feuille de style : il ne fait pas partie du texte du titre.
  // mousedown : sans cela, le clic déplacerait d'abord le curseur dans le titre.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const pos = getPos();
    if (pos !== undefined) {
      toggleFold(view, pos - 1);
    }
  });
  return button;
}

function buildDecorations(doc: ProseMirrorNode, folded: number[]): DecorationSet {
  const decorations: Decoration[] = [];
  doc.forEach((node, pos) => {
    if (node.type.name !== 'heading') {
      return;
    }
    const isFoldedHere = folded.includes(pos);
    decorations.push(
      Decoration.widget(pos + 1, (view, getPos) => createToggle(view, getPos, isFoldedHere), {
        side: -1,
        ignoreSelection: true,
        key: `fold-${isFoldedHere ? 'closed' : 'open'}`,
      }),
    );
    const section = isFoldedHere ? sectionAt(doc, pos) : null;
    if (!section) {
      return;
    }
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-folded' }));
    doc.nodesBetween(section.bodyFrom, section.to, (child, childPos) => {
      decorations.push(
        Decoration.node(childPos, childPos + child.nodeSize, { class: 'is-folded-away' }),
      );
      return false;
    });
  });
  return DecorationSet.create(doc, decorations);
}

// Pliage des chapitres : un chevron devant chaque titre replie ou déplie sa section,
// en édition comme en lecture.
export const SectionFolding = Extension.create({
  name: 'sectionFolding',

  addProseMirrorPlugins() {
    return [
      new Plugin<number[]>({
        key: foldingKey,
        state: {
          init: () => [],
          apply(transaction, folded) {
            const mapped = folded
              .map((pos) => transaction.mapping.mapResult(pos))
              .filter((result) => !result.deleted)
              .map((result) => result.pos);
            const change = transaction.getMeta(foldingKey) as FoldingChange | undefined;
            return applyChange(mapped, change ?? {}, transaction.doc);
          },
        },
        props: {
          decorations: (state) => buildDecorations(state.doc, foldingKey.getState(state) ?? []),
        },
      }),
    ];
  },
});
