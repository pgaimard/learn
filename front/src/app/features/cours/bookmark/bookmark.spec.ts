import { ContentNode } from '../content/content-node';
import { findBookmarkBlock, headingRankOf, isInSection, sectionAt } from './bookmark';

function heading(text: string): ContentNode {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] };
}

const PARAGRAPH: ContentNode = { type: 'paragraph', content: [{ type: 'text', text: 'Texte.' }] };

// Rangs : 0 texte, 1 « 1. Notion », 2 texte, 3 « 1.1 États », 4 texte, 5 « Exemple »,
// 6 texte, 7 « Exemple ».
const DOCUMENT: ContentNode = {
  type: 'doc',
  content: [
    PARAGRAPH,
    heading('1. Notion'),
    PARAGRAPH,
    heading('1.1 États'),
    PARAGRAPH,
    heading('Exemple'),
    PARAGRAPH,
    heading('Exemple'),
  ],
};

describe('sectionAt', () => {
  it('donne le dernier titre placé avant le bloc, ou le bloc lui-même si c’est un titre', () => {
    expect(sectionAt(DOCUMENT, 4)).toEqual({ title: '1.1 États', block: 3 });
    expect(sectionAt(DOCUMENT, 3)).toEqual({ title: '1.1 États', block: 3 });
    expect(sectionAt(DOCUMENT, 99)).toEqual({ title: 'Exemple', block: 7 });
  });

  it('donne le premier titre pour un bloc placé avant lui', () => {
    expect(sectionAt(DOCUMENT, 0)).toEqual({ title: '1. Notion', block: 1 });
  });

  it('ne donne rien pour un cours sans titre', () => {
    expect(sectionAt({ type: 'doc', content: [PARAGRAPH] }, 0)).toBeNull();
  });
});

describe('findBookmarkBlock', () => {
  it('retrouve le titre marqué, même déplacé par une retouche du cours', () => {
    expect(findBookmarkBlock(DOCUMENT, { title: '1.1 États', block: 12 })).toBe(3);
  });

  it('choisit, entre deux titres de même texte, le plus proche de l’ancien rang', () => {
    expect(findBookmarkBlock(DOCUMENT, { title: 'Exemple', block: 5 })).toBe(5);
    expect(findBookmarkBlock(DOCUMENT, { title: 'Exemple', block: 8 })).toBe(7);
  });

  it('ne trouve rien sans marque-page, ou quand le titre a disparu', () => {
    expect(findBookmarkBlock(DOCUMENT, null)).toBeNull();
    expect(findBookmarkBlock(DOCUMENT, { title: '3. Annexe', block: 3 })).toBeNull();
  });
});

describe('headingRankOf', () => {
  it('donne le rang du titre parmi ceux du document, celui du sommaire', () => {
    expect(headingRankOf(DOCUMENT, 1)).toBe(0);
    expect(headingRankOf(DOCUMENT, 3)).toBe(1);
    expect(headingRankOf(DOCUMENT, 7)).toBe(3);
  });
});

describe('isInSection', () => {
  // « 1 » contient « 1.1 » et « 1.2 » ; « 2 » ouvre le chapitre suivant.
  const headings = [
    { index: 0, level: 2 },
    { index: 1, level: 3 },
    { index: 2, level: 3 },
    { index: 3, level: 2 },
  ];

  it('compte le titre marqué et ses sous-titres comme le chapitre marqué', () => {
    expect(isInSection(headings, 0, 0)).toBe(true);
    expect(isInSection(headings, 0, 2)).toBe(true);
    expect(isInSection(headings, 0, 3)).toBe(false);
  });

  it('s’arrête au titre suivant de même niveau', () => {
    expect(isInSection(headings, 1, 1)).toBe(true);
    expect(isInSection(headings, 1, 2)).toBe(false);
    expect(isInSection(headings, 1, 0)).toBe(false);
  });

  it('est hors du chapitre avant le premier titre, ou pour un titre marqué disparu', () => {
    expect(isInSection(headings, 0, null)).toBe(false);
    expect(isInSection(headings, 9, 0)).toBe(false);
  });
});
