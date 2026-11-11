import { mergeAttributes, Node } from '@tiptap/core';

export const CALLOUT_KINDS = ['retenir', 'change', 'attention'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  retenir: 'À retenir',
  change: 'Ce qui a changé',
  attention: 'Attention',
};

function readKind(value: string | null): CalloutKind {
  return CALLOUT_KINDS.find((kind) => kind === value) ?? 'retenir';
}

// Encadré typé. Son libellé est affiché par la feuille de style à partir du type,
// il ne fait pas partie du texte du cours.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'retenir',
        parseHTML: (element) => readKind(element.getAttribute('data-kind')),
        renderHTML: (attributes) => ({ 'data-kind': readKind(String(attributes['kind'])) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-kind]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0];
  },
});
