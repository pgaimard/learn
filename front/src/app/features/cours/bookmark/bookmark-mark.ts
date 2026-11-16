import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';

// Rang du bloc qui porte le marque-page ; null sans marque-page. C'est un état
// d'affichage, pas du contenu.
const bookmarkKey = new PluginKey<number | null>('bookmarkMark');

export function setBookmarkBlock(view: EditorView, block: number | null): void {
  if (bookmarkKey.getState(view.state) !== block) {
    view.dispatch(view.state.tr.setMeta(bookmarkKey, { block }));
  }
}

// Signale le titre où la lecture s'est arrêtée : la feuille de style y pose un point.
export const BookmarkMark = Extension.create({
  name: 'bookmarkMark',

  addProseMirrorPlugins() {
    return [
      new Plugin<number | null>({
        key: bookmarkKey,
        state: {
          init: () => null,
          apply: (transaction, block) => {
            const requested = transaction.getMeta(bookmarkKey) as
              { block: number | null } | undefined;
            return requested ? requested.block : block;
          },
        },
        props: {
          decorations: (state) => {
            const block = bookmarkKey.getState(state) ?? null;
            if (block === null || block < 0 || block >= state.doc.childCount) {
              return DecorationSet.empty;
            }
            let pos = 0;
            for (let rank = 0; rank < block; rank++) {
              pos += state.doc.child(rank).nodeSize;
            }
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + state.doc.child(block).nodeSize, {
                class: 'is-bookmarked',
              }),
            ]);
          },
        },
      }),
    ];
  },
});
