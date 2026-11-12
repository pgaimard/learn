import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { SheetBlock, sheetBlocks } from './revision-sheet';

// Vue « fiche de révision » active ou non. C'est un état d'affichage, pas du contenu.
const sheetKey = new PluginKey<boolean>('revisionSheet');

export function setSheetView(view: EditorView, isSheet: boolean): void {
  if (sheetKey.getState(view.state) !== isSheet) {
    view.dispatch(view.state.tr.setMeta(sheetKey, isSheet));
  }
}

// Cache les blocs de premier niveau qui ne sont pas dans la fiche.
function hiddenBlocks(doc: ProseMirrorNode): DecorationSet {
  const blocks: SheetBlock[] = [];
  const positions: [number, number][] = [];
  doc.forEach((node, pos) => {
    blocks.push({ type: node.type.name, attrs: node.attrs });
    positions.push([pos, pos + node.nodeSize]);
  });
  const kept = sheetBlocks(blocks);
  return DecorationSet.create(
    doc,
    positions
      .filter((_range, index) => !kept[index])
      .map(([from, to]) => Decoration.node(from, to, { class: 'is-off-sheet' })),
  );
}

// Affiche le cours réduit à sa fiche de révision : seuls restent les encadrés
// « À retenir », les blocs épinglés et les titres qui y mènent.
export const RevisionSheetView = Extension.create({
  name: 'revisionSheetView',

  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: sheetKey,
        state: {
          init: () => false,
          apply: (transaction, isSheet) => {
            const requested: unknown = transaction.getMeta(sheetKey);
            return typeof requested === 'boolean' ? requested : isSheet;
          },
        },
        props: {
          decorations: (state) =>
            sheetKey.getState(state) ? hiddenBlocks(state.doc) : DecorationSet.empty,
        },
      }),
    ];
  },
});
