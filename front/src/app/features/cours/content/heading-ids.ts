import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, Transaction } from '@tiptap/pm/state';

// Identifiant d'un titre : il désigne sa section et ne change pas quand on le renomme.
// Son format doit rester aligné sur la liste blanche de l'API
// (api/src/courses/content/heading-ids.ts).
const HEADING_ID = /^[a-z0-9]{8}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function isHeadingId(value: unknown): value is string {
  return typeof value === 'string' && HEADING_ID.test(value);
}

function newHeadingId(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join('');
}

// Positions des titres sans identifiant, ou qui portent celui d'un titre précédent
// (titre copié, ou coupé en deux par un retour à la ligne).
function headingsToIdentify(doc: ProseMirrorNode): number[] {
  const taken = new Set<string>();
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') {
      return true;
    }
    const id: unknown = node.attrs['id'];
    if (isHeadingId(id) && !taken.has(id)) {
      taken.add(id);
    } else {
      positions.push(pos);
    }
    return false;
  });
  return positions;
}

function identify(transaction: Transaction, positions: number[]): Transaction {
  for (const pos of positions) {
    transaction.setNodeAttribute(pos, 'id', newHeadingId());
  }
  // L'attribution suit la création du titre : elle s'annule avec elle, pas à part.
  return transaction.setMeta('addToHistory', false);
}

// Attribut « id » des titres, attribué dès qu'un titre apparaît dans le document. L'API
// en donne un à ceux qui n'en ont pas, mais l'éditeur ne relit pas ce qu'il enregistre :
// sans cette extension, un titre changerait d'identifiant à chaque enregistrement.
export const HeadingIds = Extension.create({
  name: 'headingIds',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => {
              const id = element.getAttribute('data-id');
              return isHeadingId(id) ? id : null;
            },
            renderHTML: (attributes) =>
              isHeadingId(attributes['id']) ? { 'data-id': attributes['id'] } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('headingIds'),
        appendTransaction: (transactions, _oldState, state) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }
          const positions = headingsToIdentify(state.doc);
          return positions.length > 0 ? identify(state.tr, positions) : null;
        },
      }),
    ];
  },
});
