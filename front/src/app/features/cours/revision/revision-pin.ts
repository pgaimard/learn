import { Editor, Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Blocs que l'on peut épingler à la fiche de révision. Les titres n'en font pas partie :
// la fiche les garde d'elle-même quand ils mènent à un bloc gardé.
export const PINNABLE_TYPES = [
  'paragraph',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'table',
  'figure',
  'callout',
];

export function isPinnable(node: ProseMirrorNode | null | undefined): boolean {
  return !!node && PINNABLE_TYPES.includes(node.type.name);
}

export function isPinned(node: ProseMirrorNode | null | undefined): boolean {
  return isPinnable(node) && node?.attrs['pinned'] === true;
}

// Épingle le bloc situé à cette position, ou retire son épingle.
export function togglePin(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!isPinnable(node)) {
    return false;
  }
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'pinned', !isPinned(node)));
  return true;
}

function pinDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  // Seuls les blocs de premier niveau s'épinglent : inutile de descendre plus bas.
  doc.forEach((node, pos) => {
    if (isPinned(node)) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-pinned' }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

// Épingle de la fiche de révision : un attribut « pinned » enregistré avec le bloc, et un
// repère visuel sur les blocs épinglés.
export const RevisionPin = Extension.create({
  name: 'revisionPin',

  addGlobalAttributes() {
    return [
      {
        types: PINNABLE_TYPES,
        attributes: {
          pinned: {
            default: false,
            parseHTML: (element) => element.hasAttribute('data-pinned'),
            renderHTML: (attributes) =>
              attributes['pinned'] === true ? { 'data-pinned': '' } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('revisionPin'),
        // Une décoration plutôt qu'un attribut du HTML : le tableau a son propre rendu,
        // qui ignore les attributs du bloc.
        props: { decorations: (state) => pinDecorations(state.doc) },
      }),
    ];
  },
});
