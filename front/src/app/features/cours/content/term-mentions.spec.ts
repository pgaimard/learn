import { Editor } from '@tiptap/core';
import { ContentNode } from './content-node';
import { createCourseExtensions } from './course-extensions';
import { findTermMentions, MentionTerm, setMentionTerms } from './term-mentions';

const TERMS: MentionTerm[] = [
  { id: 1, type: 'definition', label: 'Processus' },
  { id: 2, type: 'definition', label: 'Commutation de contexte' },
  { id: 3, type: 'definition', label: 'Contexte' },
  { id: 4, type: 'acronym', label: 'PCB' },
  { id: 5, type: 'acronym', label: 'C++' },
];

function text(value: string, mark?: string): ContentNode {
  return { type: 'text', text: value, ...(mark ? { marks: [{ type: mark }] } : {}) };
}

function paragraph(...content: ContentNode[]): ContentNode {
  return { type: 'paragraph', content };
}

describe('termes cités dans un cours', () => {
  let editor: Editor;

  afterEach(() => editor.destroy());

  function open(...blocks: ContentNode[]): void {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: createCourseExtensions(),
      editable: false,
      content: { type: 'doc', content: blocks },
    });
  }

  // Textes des termes trouvés, avec leur identifiant.
  function mentions(...blocks: ContentNode[]): [string, number][] {
    open(...blocks);
    const { doc } = editor.state;
    return findTermMentions(doc, TERMS).map((mention) => [
      doc.textBetween(mention.from, mention.to),
      mention.termId,
    ]);
  }

  it('reconnaît une définition sans tenir compte de la casse, un acronyme à ses majuscules', () => {
    expect(mentions(paragraph(text('Un processus a un PCB ; le pcb de C++ aussi.')))).toEqual([
      ['processus', 1],
      ['PCB', 4],
      ['C++', 5],
    ]);
  });

  it('préfère le libellé le plus long et ne coupe pas les mots', () => {
    expect(
      mentions(paragraph(text('La commutation de contexte, hors contextes et PCBs.'))),
    ).toEqual([['commutation de contexte', 2]]);
  });

  it('ignore les titres et le code', () => {
    expect(
      mentions(
        { type: 'heading', attrs: { level: 2 }, content: [text('Le processus')] },
        { type: 'codeBlock', content: [text('PCB')] },
        paragraph(text('PCB', 'code')),
      ),
    ).toEqual([]);
  });

  it('pose les termes cliquables une fois la liste reçue, en lecture seulement', () => {
    open(paragraph(text('Un processus.')));
    expect(editor.view.dom.querySelector('.term-mention')).toBeNull();

    setMentionTerms(editor.view, TERMS);
    expect(editor.view.dom.querySelector('.term-mention')?.getAttribute('data-term-id')).toBe('1');

    editor.setEditable(true);
    editor.view.dispatch(editor.state.tr.insertText(' ', 1));
    expect(editor.view.dom.querySelector('.term-mention')).toBeNull();
  });
});
