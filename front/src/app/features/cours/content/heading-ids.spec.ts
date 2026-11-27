import { Editor, JSONContent } from '@tiptap/core';
import { createCourseExtensions } from './course-extensions';

const ID = /^[a-z0-9]{8}$/;

function heading(text: string, id?: string): JSONContent {
  return {
    type: 'heading',
    attrs: id === undefined ? { level: 2 } : { level: 2, id },
    content: [{ type: 'text', text }],
  };
}

function createEditor(...content: JSONContent[]): Editor {
  return new Editor({
    extensions: createCourseExtensions(),
    content: { type: 'doc', content },
  });
}

function ids(editor: Editor): unknown[] {
  return (editor.getJSON().content ?? [])
    .filter((block) => block.type === 'heading')
    .map((block) => block.attrs?.['id']);
}

describe('HeadingIds', () => {
  it('donne un identifiant au titre qu’on crée', () => {
    const editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: 'Titre' }] });

    editor.commands.setNode('heading', { level: 2 });

    expect(ids(editor)).toEqual([expect.stringMatching(ID)]);
    editor.destroy();
  });

  it('garde l’identifiant d’un titre qu’on renomme', () => {
    const editor = createEditor(heading('Ancien', 'titre001'));

    editor.commands.insertContentAt(1, 'Nouveau et ');

    expect(editor.getText()).toContain('Nouveau et Ancien');
    expect(ids(editor)).toEqual(['titre001']);
    editor.destroy();
  });

  it('renouvelle l’identifiant de la seconde moitié d’un titre coupé en deux', () => {
    const editor = createEditor(heading('Premier second', 'titre001'));

    editor.commands.setTextSelection(8);
    editor.commands.splitBlock({ keepMarks: false });
    const [first, second] = ids(editor);

    expect(first).toBe('titre001');
    expect(second === undefined || second === 'titre001').toBe(false);
    editor.destroy();
  });

  it('renouvelle l’identifiant d’un titre collé en double', () => {
    const editor = createEditor(heading('Titre', 'titre001'));

    editor.commands.insertContentAt(editor.state.doc.content.size, heading('Titre', 'titre001'));
    const [first, second] = ids(editor);

    expect(first).toBe('titre001');
    expect(second).toMatch(ID);
    expect(second).not.toBe('titre001');
    editor.destroy();
  });

  it('écarte un identifiant mal formé venu d’un collage', () => {
    const editor = createEditor({ type: 'paragraph' });

    editor.commands.setContent('<h2 data-id="&lt;script&gt;">Titre</h2>', { emitUpdate: true });
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' });

    expect(ids(editor)).toEqual([expect.stringMatching(ID)]);
    editor.destroy();
  });

  it('laisse intact un document relu sans modification', () => {
    const editor = createEditor(heading('Titre', 'titre001'), { type: 'paragraph' });

    expect(ids(editor)).toEqual(['titre001']);
    editor.destroy();
  });
});
