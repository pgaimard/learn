import { Editor } from '@tiptap/core';
import { createCourseExtensions } from './course-extensions';

const CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'codeBlock',
      attrs: { language: 'c' },
      content: [{ type: 'text', text: 'pid_t pid = fork();' }],
    },
  ],
};

describe('bloc de code', () => {
  let editor: Editor;

  function setup(editable: boolean): void {
    editor = new Editor({ extensions: createCourseExtensions(), content: CONTENT, editable });
  }

  function select(): HTMLSelectElement {
    return editor.view.dom.querySelector('select.code-language') as HTMLSelectElement;
  }

  afterEach(() => editor.destroy());

  it('porte le choix du langage sur le bloc, avec le langage enregistré', () => {
    setup(true);

    expect(select().hidden).toBe(false);
    expect(select().value).toBe('c');
    expect(editor.view.dom.querySelector('.code-block pre code')?.textContent).toBe(
      'pid_t pid = fork();',
    );
  });

  it('change le langage du bloc, ou revient à la détection automatique', () => {
    setup(true);

    select().value = 'python';
    select().dispatchEvent(new Event('change'));
    expect(editor.getJSON().content?.[0].attrs).toEqual({ language: 'python' });

    select().value = '';
    select().dispatchEvent(new Event('change'));
    expect(editor.getJSON().content?.[0].attrs).toEqual({ language: null });
  });

  it('suit un changement de langage venu d’ailleurs', () => {
    setup(true);

    editor.commands.updateAttributes('codeBlock', { language: 'sql' });

    expect(select().value).toBe('sql');
  });

  it('ne propose pas de changer le langage en lecture', () => {
    setup(false);

    expect(select().hidden).toBe(true);
  });

  it('enregistre le même contenu qu’un bloc de code standard', () => {
    setup(true);

    expect(editor.getJSON()).toEqual(CONTENT);
    expect(editor.getHTML()).toBe('<pre><code class="language-c">pid_t pid = fork();</code></pre>');
  });
});
