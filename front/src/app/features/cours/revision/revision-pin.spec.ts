import { Editor } from '@tiptap/core';
import { createCourseExtensions } from '../content/course-extensions';
import { isPinned, togglePin } from './revision-pin';

describe('épingle de la fiche de révision', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Titre' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Définition clé.' }] },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }],
              },
            ],
          },
        ],
      },
    });
  });

  afterEach(() => editor.destroy());

  const paragraphPos = (): number => editor.state.doc.child(0).nodeSize;
  const tablePos = (): number => paragraphPos() + editor.state.doc.child(1).nodeSize;

  it('n’épingle rien par défaut, y compris un contenu qui ne porte pas l’attribut', () => {
    expect(isPinned(editor.state.doc.child(1))).toBe(false);
    expect(editor.getJSON().content?.[1].attrs).toEqual({ pinned: false });
  });

  it('épingle un bloc puis retire l’épingle, dans le contenu enregistré', () => {
    expect(togglePin(editor, paragraphPos())).toBe(true);
    expect(editor.getJSON().content?.[1].attrs).toEqual({ pinned: true });

    togglePin(editor, paragraphPos());
    expect(editor.getJSON().content?.[1].attrs).toEqual({ pinned: false });
  });

  it('marque à l’écran les blocs épinglés, tableau compris', () => {
    togglePin(editor, paragraphPos());
    togglePin(editor, tablePos());

    const marked = Array.from(editor.view.dom.querySelectorAll('.is-pinned'));
    expect(marked).toHaveLength(2);
    expect(marked[0].tagName).toBe('P');
    expect(marked[1].querySelector('table')).not.toBeNull();
  });

  it('n’épingle pas un titre', () => {
    expect(togglePin(editor, 0)).toBe(false);
    expect(editor.getJSON().content?.[0].attrs).toEqual({ level: 2 });
  });

  it('garde l’épingle quand le bloc est copié en HTML puis relu', () => {
    togglePin(editor, paragraphPos());

    editor.commands.setContent(editor.getHTML());

    expect(isPinned(editor.state.doc.child(1))).toBe(true);
  });
});
