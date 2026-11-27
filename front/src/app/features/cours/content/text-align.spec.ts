import { Editor } from '@tiptap/core';
import { createCourseExtensions } from './course-extensions';
import { setTextAlign } from './text-align';

describe('alignement du texte', () => {
  let editor: Editor;
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    editor = new Editor({
      element: host,
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Titre' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Un' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Deux' }] },
        ],
      },
    });
  });

  afterEach(() => {
    editor.destroy();
    host.remove();
  });

  function alignments(): unknown[] {
    const found: unknown[] = [];
    editor.state.doc.forEach((node) => found.push(node.attrs['textAlign']));
    return found;
  }

  it('aligne le paragraphe du curseur et le montre par une classe', () => {
    editor.commands.setTextSelection(9);

    setTextAlign(editor, 'center');

    expect(alignments()).toEqual([null, 'center', null]);
    expect(host.querySelectorAll('p')[0].className).toBe('align-center');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
  });

  it('aligne tous les blocs de la sélection, titres compris', () => {
    editor.commands.selectAll();

    setTextAlign(editor, 'justify');

    expect(alignments()).toEqual(['justify', 'justify', 'justify']);
  });

  it('rend l’alignement par défaut', () => {
    editor.commands.selectAll();
    setTextAlign(editor, 'right');

    setTextAlign(editor, null);

    expect(alignments()).toEqual([null, null, null]);
    expect(host.querySelector('[class^="align-"]')).toBeNull();
  });

  it('relit l’alignement d’un contenu collé, et ignore une valeur inconnue', () => {
    editor.commands.setContent('<p class="align-right">a</p><p class="align-evil">b</p>');

    expect(alignments()).toEqual(['right', null]);
  });
});
