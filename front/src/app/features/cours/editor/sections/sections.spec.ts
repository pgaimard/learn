import { Editor } from '@tiptap/core';
import { ContentNode } from '../../content/content-node';
import { createCourseExtensions } from '../../content/course-extensions';
import {
  canMoveUnit,
  canShiftSectionLevel,
  dropSection,
  moveUnit,
  shiftSectionLevel,
} from './section-commands';
import { isFolded, revealPosition, toggleFold } from './section-folding';
import { sectionAt, siblingSection } from './section-range';

function heading(level: number, text: string): ContentNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function paragraph(text: string): ContentNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

// 0 intro · 1 H2 A · 2 a · 3 H3 A1 · 4 a1 · 5 H3 A2 · 6 a2 · 7 H2 B · 8 b
const DOCUMENT: ContentNode[] = [
  paragraph('intro'),
  heading(2, 'A'),
  paragraph('a'),
  heading(3, 'A1'),
  paragraph('a1'),
  heading(3, 'A2'),
  paragraph('a2'),
  heading(2, 'B'),
  paragraph('b'),
];

describe('chapitres', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: { type: 'doc', content: DOCUMENT },
    });
  });

  afterEach(() => editor.destroy());

  // Position du bloc qui porte ce texte.
  function posOf(text: string): number {
    let found = -1;
    editor.state.doc.forEach((node, pos) => {
      if (node.textContent === text) {
        found = pos;
      }
    });
    return found;
  }

  function outline(): string {
    const texts: string[] = [];
    editor.state.doc.forEach((node) => {
      const level: unknown = node.attrs['level'];
      texts.push(
        typeof level === 'number' ? `${'#'.repeat(level)}${node.textContent}` : node.textContent,
      );
    });
    return texts.join(' ');
  }

  // Textes des blocs cachés par un pliage.
  function hidden(): string[] {
    return Array.from(editor.view.dom.querySelectorAll('.is-folded-away')).map(
      (element) => element.textContent ?? '',
    );
  }

  describe('étendue', () => {
    it('va du titre au prochain titre de même niveau ou supérieur', () => {
      const a = sectionAt(editor.state.doc, posOf('A'));
      const a1 = sectionAt(editor.state.doc, posOf('A1'));

      expect(a).toMatchObject({
        from: posOf('A'),
        to: posOf('B'),
        level: 2,
        index: 1,
        endIndex: 7,
      });
      expect(a1).toMatchObject({ from: posOf('A1'), to: posOf('A2'), level: 3 });
      expect(sectionAt(editor.state.doc, posOf('B'))?.to).toBe(editor.state.doc.content.size);
    });

    it('n’existe pas pour un bloc qui n’est pas un titre', () => {
      expect(sectionAt(editor.state.doc, posOf('a'))).toBeNull();
    });

    it('trouve le chapitre voisin de même niveau, sans sortir du chapitre parent', () => {
      const doc = editor.state.doc;
      const a1 = sectionAt(doc, posOf('A1'));
      const a2 = sectionAt(doc, posOf('A2'));
      const a = sectionAt(doc, posOf('A'));
      if (!a1 || !a2 || !a) {
        throw new Error('chapitres attendus');
      }

      expect(siblingSection(doc, a1, 1)?.from).toBe(posOf('A2'));
      expect(siblingSection(doc, a2, -1)?.from).toBe(posOf('A1'));
      expect(siblingSection(doc, a2, 1)).toBeNull();
      expect(siblingSection(doc, a1, -1)).toBeNull();
      expect(siblingSection(doc, a, 1)?.from).toBe(posOf('B'));
      expect(siblingSection(doc, a, -1)).toBeNull();
    });
  });

  describe('déplacement', () => {
    it('descend un chapitre entier sous le chapitre suivant', () => {
      expect(moveUnit(editor, posOf('A'), 1)).toBe(true);

      expect(outline()).toBe('intro ##B b ##A a ###A1 a1 ###A2 a2');
    });

    it('monte une sous-section au-dessus de sa voisine', () => {
      expect(moveUnit(editor, posOf('A2'), -1)).toBe(true);

      expect(outline()).toBe('intro ##A a ###A2 a2 ###A1 a1 ##B b');
    });

    it('ne sort pas une sous-section de son chapitre', () => {
      expect(canMoveUnit(editor, posOf('A2'), 1)).toBe(false);
      expect(moveUnit(editor, posOf('A1'), -1)).toBe(false);
      expect(outline()).toBe('intro ##A a ###A1 a1 ###A2 a2 ##B b');
    });

    it('déplace seul un bloc qui n’est pas un titre', () => {
      expect(moveUnit(editor, posOf('a1'), -1)).toBe(true);

      expect(outline()).toBe('intro ##A a a1 ###A1 ###A2 a2 ##B b');
    });

    it('dépose un chapitre entre deux blocs, à l’endroit visé', () => {
      const section = sectionAt(editor.state.doc, posOf('A1'));
      const transaction =
        section && dropSection(editor.state, section, editor.state.doc.content.size);
      if (transaction) {
        editor.view.dispatch(transaction);
      }

      expect(outline()).toBe('intro ##A a ###A2 a2 ##B b ###A1 a1');
    });

    it('dépose avant ou après le bloc visé selon la moitié touchée', () => {
      const section = sectionAt(editor.state.doc, posOf('B'));
      const transaction = section && dropSection(editor.state, section, posOf('intro') + 1);
      if (transaction) {
        editor.view.dispatch(transaction);
      }

      expect(outline()).toBe('##B b intro ##A a ###A1 a1 ###A2 a2');
    });

    it('ignore un dépôt du chapitre sur lui-même', () => {
      const section = sectionAt(editor.state.doc, posOf('A'));

      expect(section && dropSection(editor.state, section, posOf('a1') + 1)).toBeNull();
    });
  });

  describe('niveau', () => {
    it('change le niveau d’un chapitre avec ses sous-titres', () => {
      expect(shiftSectionLevel(editor, posOf('A'), 1)).toBe(true);

      expect(outline()).toBe('intro ###A a ####A1 a1 ####A2 a2 ##B b');
    });

    it('refuse de sortir des niveaux existants', () => {
      expect(canShiftSectionLevel(editor, posOf('A'), -1)).toBe(false);
      expect(canShiftSectionLevel(editor, posOf('A1'), -1)).toBe(true);

      shiftSectionLevel(editor, posOf('A'), 1);
      shiftSectionLevel(editor, posOf('A'), 1);

      expect(canShiftSectionLevel(editor, posOf('A'), 1)).toBe(false);
      expect(shiftSectionLevel(editor, posOf('A'), 1)).toBe(false);
      expect(outline()).toBe('intro ####A a #####A1 a1 #####A2 a2 ##B b');
    });
  });

  describe('pliage', () => {
    it('cache le contenu du chapitre, sous-chapitres compris, puis le montre', () => {
      toggleFold(editor.view, posOf('A'));

      expect(isFolded(editor.state, posOf('A'))).toBe(true);
      expect(hidden()).toEqual(['a', 'A1', 'a1', 'A2', 'a2']);

      toggleFold(editor.view, posOf('A'));
      expect(hidden()).toEqual([]);
    });

    it('ne modifie pas le contenu enregistré', () => {
      const before = editor.getJSON();

      toggleFold(editor.view, posOf('A'));

      expect(editor.getJSON()).toEqual(before);
    });

    it('sort le curseur du texte qu’il cache', () => {
      editor.commands.setTextSelection(posOf('a1') + 1);

      toggleFold(editor.view, posOf('A'));

      expect(editor.state.selection.from).toBe(posOf('a') - 1);
    });

    it('suit le titre quand on écrit au-dessus', () => {
      toggleFold(editor.view, posOf('A1'));

      editor.commands.insertContentAt(1, 'début ');

      expect(isFolded(editor.state, posOf('A1'))).toBe(true);
      expect(hidden()).toEqual(['a1']);
    });

    it('se bascule par le chevron du titre', () => {
      const chevron = editor.view.dom.querySelectorAll<HTMLButtonElement>('.fold-toggle')[1];

      chevron.click();

      expect(isFolded(editor.state, posOf('A1'))).toBe(true);
      expect(
        editor.view.dom.querySelectorAll('.fold-toggle')[1].getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('déplie ce qui cache un titre atteint par le sommaire', () => {
      toggleFold(editor.view, posOf('A'));
      toggleFold(editor.view, posOf('B'));

      revealPosition(editor.view, posOf('A2') + 1);

      expect(isFolded(editor.state, posOf('A'))).toBe(false);
      expect(isFolded(editor.state, posOf('B'))).toBe(true);
    });

    it('reste replié quand le chapitre est déplacé', () => {
      toggleFold(editor.view, posOf('A'));
      toggleFold(editor.view, posOf('A1'));

      moveUnit(editor, posOf('A'), 1);

      expect(outline()).toBe('intro ##B b ##A a ###A1 a1 ###A2 a2');
      expect(isFolded(editor.state, posOf('A'))).toBe(true);
      expect(isFolded(editor.state, posOf('A1'))).toBe(true);
      expect(isFolded(editor.state, posOf('B'))).toBe(false);
    });

    it('reste replié quand le chapitre est déposé ailleurs', () => {
      toggleFold(editor.view, posOf('B'));
      const section = sectionAt(editor.state.doc, posOf('B'));
      // Déposé juste avant le chapitre A.
      const transaction = section && dropSection(editor.state, section, posOf('A'));
      if (transaction) {
        editor.view.dispatch(transaction);
      }

      expect(outline()).toBe('intro ##B b ##A a ###A1 a1 ###A2 a2');
      expect(isFolded(editor.state, posOf('B'))).toBe(true);
      expect(hidden()).toEqual(['b']);
    });
  });
});
