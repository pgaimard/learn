import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import { createCourseExtensions } from '../../content/course-extensions';
import { CodeBlockBar } from './code-block-bar';

describe('CodeBlockBar', () => {
  let fixture: ComponentFixture<CodeBlockBar>;
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'c' },
            content: [{ type: 'text', text: 'pid_t pid = fork();' }],
          },
        ],
      },
    });
    fixture = TestBed.createComponent(CodeBlockBar);
    fixture.componentRef.setInput('editor', editor);
    fixture.componentRef.setInput('pos', 0);
    fixture.detectChanges();
  });

  afterEach(() => editor.destroy());

  function select(): HTMLSelectElement {
    return (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
  }

  function choose(value: string): void {
    select().value = value;
    select().dispatchEvent(new Event('change'));
  }

  it('montre le langage du bloc', () => {
    expect(select().value).toBe('c');
    expect((fixture.nativeElement as HTMLElement).querySelector('label')?.textContent).toBe(
      'Langage',
    );
  });

  it('change le langage du bloc, ou revient à la détection automatique', () => {
    choose('python');
    expect(editor.getJSON().content?.[0].attrs).toEqual({ language: 'python' });

    choose('');
    expect(editor.getJSON().content?.[0].attrs).toEqual({ language: null });
  });

  it('ne touche pas au code', () => {
    choose('sql');

    expect(editor.state.doc.textContent).toBe('pid_t pid = fork();');
  });
});
