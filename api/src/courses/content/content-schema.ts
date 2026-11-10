// Liste blanche du contenu d'un cours. Tout ce qui n'y figure pas est refusé :
// le contenu reçu est traité comme hostile, même s'il vient de notre éditeur.

type AttributeCheck = (value: unknown) => boolean;

export interface NodeRule {
  // Groupe ou liste de types acceptés comme enfants ; « text » pour du texte sans marque.
  children: 'none' | 'text' | 'inline' | 'block' | readonly string[];
  minChildren?: number;
  attrs?: Record<string, AttributeCheck>;
}

const isNullable =
  (check: AttributeCheck): AttributeCheck =>
  (value) =>
    value === null || check(value);

const isIntegerBetween =
  (min: number, max: number): AttributeCheck =>
  (value) =>
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max;

const isShortString: AttributeCheck = (value) =>
  typeof value === 'string' && value.length <= 100;

const isColumnWidths: AttributeCheck = (value) =>
  Array.isArray(value) && value.every(isIntegerBetween(1, 5000));

const SAFE_LINK = /^(https?:\/\/|mailto:|#)/i;

export const isSafeLink: AttributeCheck = (value) =>
  typeof value === 'string' && value.length <= 2000 && SAFE_LINK.test(value);

export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'table',
  'horizontalRule',
] as const;

export const INLINE_TYPES = ['text', 'hardBreak'] as const;

const cellAttrs: Record<string, AttributeCheck> = {
  colspan: isIntegerBetween(1, 50),
  rowspan: isIntegerBetween(1, 500),
  colwidth: isNullable(isColumnWidths),
};

export const NODE_RULES: Record<string, NodeRule> = {
  doc: { children: 'block', minChildren: 1 },
  paragraph: { children: 'inline' },
  heading: {
    children: 'inline',
    // Le niveau 1 est réservé au titre du cours.
    attrs: { level: isIntegerBetween(2, 4) },
  },
  bulletList: { children: ['listItem'], minChildren: 1 },
  orderedList: {
    children: ['listItem'],
    minChildren: 1,
    attrs: {
      start: isIntegerBetween(0, 100000),
      type: isNullable(isShortString),
    },
  },
  listItem: { children: 'block', minChildren: 1 },
  blockquote: { children: 'block', minChildren: 1 },
  codeBlock: {
    children: 'text',
    attrs: { language: isNullable(isShortString) },
  },
  table: { children: ['tableRow'], minChildren: 1 },
  tableRow: { children: ['tableCell', 'tableHeader'], minChildren: 1 },
  tableCell: { children: 'block', minChildren: 1, attrs: cellAttrs },
  tableHeader: { children: 'block', minChildren: 1, attrs: cellAttrs },
  horizontalRule: { children: 'none' },
  hardBreak: { children: 'none' },
};

export const MARK_RULES: Record<string, Record<string, AttributeCheck>> = {
  bold: {},
  italic: {},
  strike: {},
  underline: {},
  code: {},
  link: {
    href: isSafeLink,
    target: isNullable((value) => value === '_blank'),
    rel: isNullable(isShortString),
    class: (value) => value === null,
  },
};
