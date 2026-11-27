import { isImageSource } from './collect-figures.js';

// Liste blanche du contenu d'un cours. Tout ce qui n'y figure pas est refusé :
// le contenu reçu est traité comme hostile, même s'il vient de notre éditeur.

type AttributeCheck = (value: unknown) => boolean;

export interface NodeRule {
  // Groupe ou liste de types acceptés comme enfants ; « text » pour du texte sans marque.
  children: 'none' | 'text' | 'inline' | 'block' | readonly string[];
  minChildren?: number;
  maxChildren?: number;
  // Type imposé au premier enfant ; il n'est accepté qu'à cette place.
  firstChild?: string;
  // Type imposé au dernier enfant ; il n'est accepté qu'à cette place.
  lastChild?: string;
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

const isOneOf =
  (values: readonly string[]): AttributeCheck =>
  (value) =>
    typeof value === 'string' && values.includes(value);

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
  'figure',
  'callout',
] as const;

export const INLINE_TYPES = ['text', 'hardBreak'] as const;

// Un diaporama ne se place qu'au premier niveau du document : ni dans un encadré, ni
// dans un tableau, ni dans un autre diaporama.
export const MAX_SLIDES = 60;

// Un QCM ne se place lui aussi qu'au premier niveau du document.
export const MAX_QUIZ_QUESTIONS = 50;
export const MAX_QUIZ_CHOICES = 10;
const QUIZ_TEXT = ['paragraph', 'bulletList', 'orderedList', 'codeBlock'];

const cellAttrs: Record<string, AttributeCheck> = {
  colspan: isIntegerBetween(1, 50),
  rowspan: isIntegerBetween(1, 500),
  colwidth: isNullable(isColumnWidths),
  align: isNullable(isOneOf(['left', 'center', 'right'])),
};

// Bloc épinglé à la fiche de révision du cours.
const pinned: Record<string, AttributeCheck> = {
  pinned: (value) => typeof value === 'boolean',
};

export const NODE_RULES: Record<string, NodeRule> = {
  doc: { children: [...BLOCK_TYPES, 'slideshow', 'quiz'], minChildren: 1 },
  paragraph: { children: 'inline', attrs: pinned },
  heading: {
    children: 'inline',
    // Le niveau 1 est réservé au titre du cours.
    attrs: { level: isIntegerBetween(2, 5) },
  },
  bulletList: { children: ['listItem'], minChildren: 1, attrs: pinned },
  orderedList: {
    children: ['listItem'],
    minChildren: 1,
    attrs: {
      ...pinned,
      start: isIntegerBetween(0, 100000),
      type: isNullable(isShortString),
    },
  },
  listItem: { children: 'block', minChildren: 1 },
  blockquote: { children: 'block', minChildren: 1, attrs: pinned },
  codeBlock: {
    children: 'text',
    attrs: { ...pinned, language: isNullable(isShortString) },
  },
  table: { children: ['tableRow'], minChildren: 1, attrs: pinned },
  tableRow: { children: ['tableCell', 'tableHeader'], minChildren: 1 },
  tableCell: { children: 'block', minChildren: 1, attrs: cellAttrs },
  tableHeader: { children: 'block', minChildren: 1, attrs: cellAttrs },
  horizontalRule: { children: 'none' },
  // Image du cours avec sa légende ; la source désigne toujours une image interne.
  figure: {
    children: 'inline',
    attrs: {
      ...pinned,
      src: isImageSource,
      alt: (value) => typeof value === 'string' && value.length <= 500,
    },
  },
  // Encadré typé : « À retenir », « Ce qui a changé », « Attention », « Définition »,
  // « À savoir », « À noter », « Astuce ».
  callout: {
    children: 'block',
    minChildren: 1,
    attrs: {
      ...pinned,
      kind: isOneOf([
        'retenir',
        'change',
        'attention',
        'definition',
        'savoir',
        'noter',
        'astuce',
      ]),
    },
  },
  // Diaporama : une suite d'étapes qu'on fait défiler, pour suivre un déroulement image
  // par image. Son titre est facultatif.
  slideshow: {
    children: ['slide'],
    minChildren: 1,
    maxChildren: MAX_SLIDES,
    attrs: {
      title: (value) => typeof value === 'string' && value.length <= 200,
    },
  },
  // Étape d'un diaporama : son image (dont la légende sert de titre d'étape), puis son
  // explication.
  slide: {
    children: ['paragraph', 'bulletList', 'orderedList'],
    firstChild: 'figure',
    minChildren: 1,
  },
  // QCM : une suite de questions auxquelles on répond dans le cours. Son titre est
  // facultatif.
  quiz: {
    children: ['quizQuestion'],
    minChildren: 1,
    maxChildren: MAX_QUIZ_QUESTIONS,
    attrs: {
      title: (value) => typeof value === 'string' && value.length <= 200,
    },
  },
  // Question d'un QCM : son énoncé, ses choix (deux au moins), puis l'explication montrée
  // une fois la réponse validée.
  quizQuestion: {
    children: ['quizChoice'],
    firstChild: 'quizPrompt',
    lastChild: 'quizExplanation',
    minChildren: 4,
    maxChildren: MAX_QUIZ_CHOICES + 2,
  },
  quizPrompt: { children: [...QUIZ_TEXT, 'figure'], minChildren: 1 },
  quizChoice: {
    children: 'inline',
    attrs: { correct: (value) => typeof value === 'boolean' },
  },
  quizExplanation: { children: QUIZ_TEXT, minChildren: 1 },
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
    title: isNullable(isShortString),
  },
};
