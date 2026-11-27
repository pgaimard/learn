import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { ContentNode } from '../content/content-node';
import { createCourseExtensions } from '../content/course-extensions';
import { moveSlide, removeSlide, slideshowAtSelection } from './slideshow';

function slide(step: string): ContentNode {
  return {
    type: 'slide',
    content: [
      {
        type: 'figure',
        attrs: { src: `/api/courses/1/images/${step}`, alt: '' },
        content: [{ type: 'text', text: `Étape ${step}` }],
      },
      { type: 'paragraph', content: [{ type: 'text', text: `Texte ${step}` }] },
    ],
  };
}

describe('diaporama', () => {
  let editor: Editor;

  function setup(...slides: ContentNode[]): void {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Avant.' }] },
          { type: 'slideshow', attrs: { title: 'Cycle' }, content: slides },
        ],
      },
    });
  }

  afterEach(() => editor.destroy());

  // Position de l'étape de ce rang, et légendes des étapes dans l'ordre.
  function slidePos(index: number): number {
    const show = editor.state.doc.child(1);
    let pos = editor.state.doc.child(0).nodeSize + 1;
    for (let rank = 0; rank < index; rank++) {
      pos += show.child(rank).nodeSize;
    }
    return pos;
  }

  function captions(): string[] {
    const found: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'figure') {
        found.push(node.textContent);
      }
    });
    return found;
  }

  it('est un bloc valide du document, dont le titre se modifie', () => {
    setup(slide('1'), slide('2'));

    expect(() => editor.state.doc.check()).not.toThrow();
    const pos = editor.state.doc.child(0).nodeSize;
    editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'title', 'Nouveau titre'));

    expect(editor.state.doc.child(1).attrs['title']).toBe('Nouveau titre');
  });

  it('monte et descend une étape, sauf aux extrémités', () => {
    setup(slide('1'), slide('2'), slide('3'));

    const down = moveSlide(editor.state, slidePos(0), 1);
    expect(down).not.toBeNull();
    if (down) {
      editor.view.dispatch(down);
    }
    expect(captions()).toEqual(['Étape 2', 'Étape 1', 'Étape 3']);

    const up = moveSlide(editor.state, slidePos(2), -1);
    if (up) {
      editor.view.dispatch(up);
    }
    expect(captions()).toEqual(['Étape 2', 'Étape 3', 'Étape 1']);

    expect(moveSlide(editor.state, slidePos(0), -1)).toBeNull();
    expect(moveSlide(editor.state, slidePos(2), 1)).toBeNull();
  });

  it('supprime une étape ; la dernière emporte le diaporama', () => {
    setup(slide('1'), slide('2'));

    const first = removeSlide(editor.state, slidePos(0));
    if (first) {
      editor.view.dispatch(first);
    }
    expect(captions()).toEqual(['Étape 2']);

    const last = removeSlide(editor.state, slidePos(0));
    if (last) {
      editor.view.dispatch(last);
    }
    const types: string[] = [];
    editor.state.doc.forEach((node) => types.push(node.type.name));
    expect(types).not.toContain('slideshow');
    expect(captions()).toEqual([]);
  });

  it('sait si le curseur est dans un diaporama, et où finit son étape', () => {
    setup(slide('1'), slide('2'));
    expect(slideshowAtSelection(editor.state)).toBeNull();

    // Dans l'explication de la première étape.
    const inside = slidePos(0) + 1 + editor.state.doc.child(1).child(0).child(0).nodeSize + 1;
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, inside)),
    );

    expect(slideshowAtSelection(editor.state)).toEqual({ count: 2, afterSlide: slidePos(1) });
  });
});
