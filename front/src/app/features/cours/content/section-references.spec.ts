import { Editor } from '@tiptap/core';
import { ContentNode } from './content-node';
import { createCourseExtensions } from './course-extensions';
import { findSectionReferences } from './section-references';

function heading(text: string, level = 2): ContentNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function paragraph(...content: ContentNode[]): ContentNode {
  return { type: 'paragraph', content };
}

function text(value: string, mark?: string): ContentNode {
  return { type: 'text', text: value, ...(mark ? { marks: [{ type: mark }] } : {}) };
}

describe('renvois vers les sections', () => {
  let editor: Editor;

  afterEach(() => editor.destroy());

  // Textes des renvois trouvés, avec le rang du titre visé.
  function references(...blocks: ContentNode[]): [string, number][] {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: createCourseExtensions(),
      editable: false,
      content: {
        type: 'doc',
        content: [
          heading('1. Notion'),
          heading('1.1 États', 3),
          heading('2. Ordonnancement'),
          heading('Sans numéro', 3),
          heading('2.1 Tourniquet', 3),
          ...blocks,
        ],
      },
    });
    const { doc } = editor.state;
    return findSectionReferences(doc).map((reference) => [
      doc.textBetween(reference.from, reference.to),
      reference.headingIndex,
    ]);
  }

  it('reconnaît un numéro de section derrière un mot qui l’annonce', () => {
    expect(
      references(paragraph(text('Voir section 1.1, puis § 2.1 ; cf. 2, réf. 1.1 et la partie 1.'))),
    ).toEqual([
      ['section 1.1', 1],
      ['§ 2.1', 4],
      ['cf. 2', 2],
      ['réf. 1.1', 1],
      ['partie 1', 0],
    ]);
  });

  it('suit une liste de numéros annoncée par un seul mot', () => {
    expect(references(paragraph(text('Comparer les sections 1.1 et 2.1.')))).toEqual([
      ['sections 1.1', 1],
      ['2.1', 4],
    ]);
  });

  it('ignore un numéro sans mot devant, une section absente, le code et les titres', () => {
    expect(
      references(
        paragraph(text('À 2.1 GHz, la version 1.1 ; voir section 9.9 ; revoir 2.')),
        paragraph(text('voir 2.1', 'code')),
        { type: 'codeBlock', content: [text('voir 2.1')] },
        heading('3. Suite de la section 1.1'),
      ),
    ).toEqual([]);
  });

  it('retrouve un renvoi dont le numéro est mis en forme', () => {
    expect(references(paragraph(text('voir '), text('2.1', 'bold')))).toEqual([['voir 2.1', 4]]);
  });

  it('pose les liens en lecture seulement', () => {
    references(paragraph(text('voir 2.1')));
    expect(editor.view.dom.querySelector('.section-ref')?.getAttribute('data-heading')).toBe('4');

    editor.setEditable(true);
    editor.view.dispatch(editor.state.tr.insertText(' ', 1));
    expect(editor.view.dom.querySelector('.section-ref')).toBeNull();
  });
});
