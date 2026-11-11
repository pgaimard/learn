import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { createCourseExtensions } from '../../content/course-extensions';
import { SelectionBar } from './selection-bar';

describe('barre de mise en forme', () => {
  let editor: Editor;
  let shown: ({ top: number; left: number } | null)[];
  let codeBlocks: ({ pos: number; top: number; left: number } | null)[];

  function setup(): void {
    shown = [];
    codeBlocks = [];
    editor = new Editor({
      extensions: createCourseExtensions({
        blockHandle: { onOpenMenu: () => undefined },
        tableTools: { onOpenMenu: () => undefined },
        selection: {
          onChange: (target) => shown.push(target),
          onCodeBlock: (target) => codeBlocks.push(target),
        },
      }),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'un texte' }] },
          { type: 'codeBlock', content: [{ type: 'text', text: 'du code' }] },
        ],
      },
    });
  }

  afterEach(() => editor.destroy());

  describe('apparition', () => {
    beforeEach(setup);

    it('se montre pour une sélection de texte et se cache quand elle se vide', () => {
      editor.commands.setTextSelection({ from: 1, to: 3 });
      expect(shown.at(-1)).not.toBeNull();

      editor.commands.setTextSelection(2);
      expect(shown.at(-1)).toBeNull();
    });

    it('ne se montre pas dans un bloc de code', () => {
      editor.commands.setTextSelection({ from: 12, to: 15 });

      expect(shown.at(-1)).toBeNull();
    });

    it('signale le bloc de code où se trouve le curseur, et quand il en sort', () => {
      editor.commands.setTextSelection(13);
      expect(codeBlocks.at(-1)).toMatchObject({ pos: 10 });

      editor.commands.setTextSelection(2);
      expect(codeBlocks.at(-1)).toBeNull();
    });

    it('garde les barres quand le focus passe dans l’une d’elles', () => {
      const bar = document.createElement('div');
      bar.setAttribute('data-editor-bar', '');
      const field = document.createElement('select');
      bar.append(field);
      editor.commands.setTextSelection(13);

      editor.view.dom.dispatchEvent(new FocusEvent('blur', { relatedTarget: field }));
      expect(codeBlocks.at(-1)).not.toBeNull();

      editor.view.dom.dispatchEvent(new FocusEvent('blur'));
      expect(codeBlocks.at(-1)).toBeNull();
    });

    it('attend que le bouton de la souris soit relâché', () => {
      vi.useFakeTimers();
      editor.view.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      editor.commands.setTextSelection({ from: 1, to: 3 });
      expect(shown.at(-1)).toBeNull();

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      vi.runAllTimers();
      vi.useRealTimers();

      expect(shown.at(-1)).not.toBeNull();
    });

    it('se cache quand le curseur quitte l’éditeur ou que l’édition est désactivée', () => {
      editor.commands.setTextSelection({ from: 1, to: 3 });
      editor.view.dom.dispatchEvent(new FocusEvent('blur'));
      expect(shown.at(-1)).toBeNull();

      editor.commands.setTextSelection({ from: 1, to: 4 });
      editor.setEditable(false);
      expect(shown.at(-1)).toBeNull();
    });
  });

  describe('boutons', () => {
    let fixture: ComponentFixture<SelectionBar>;
    const dialog = { prompt: vi.fn<DialogService['prompt']>() };

    beforeEach(() => {
      setup();
      editor.commands.setTextSelection({ from: 1, to: 3 });
      TestBed.configureTestingModule({
        providers: [{ provide: DialogService, useValue: dialog }],
      });
      fixture = TestBed.createComponent(SelectionBar);
      fixture.componentRef.setInput('editor', editor);
      fixture.detectChanges();
    });

    function button(label: string): HTMLButtonElement {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
        (candidate) =>
          candidate.getAttribute('aria-label') === label || candidate.textContent.trim() === label,
      ) as HTMLButtonElement;
    }

    it('met la sélection en gras et reflète l’état du bouton', () => {
      button('Gras').click();
      fixture.detectChanges();

      expect(editor.getHTML()).toContain('<strong>un</strong> texte');
      expect(button('Gras').getAttribute('aria-pressed')).toBe('true');
      expect(button('Italique').getAttribute('aria-pressed')).toBe('false');
    });

    it('applique italique, souligné, barré et code', () => {
      for (const label of ['Italique', 'Souligné', 'Barré']) {
        button(label).click();
      }

      expect(editor.getHTML()).toContain('<em><s><u>un</u></s></em>');
    });

    it('garde la sélection quand on clique la barre', () => {
      const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

      button('Gras').dispatchEvent(press);

      expect(press.defaultPrevented).toBe(true);
    });

    it('pose un lien avec l’adresse saisie', async () => {
      dialog.prompt.mockResolvedValue('https://www.cnam.fr');

      button('Lien').click();
      await new Promise((resolve) => setTimeout(resolve));

      expect(editor.getHTML()).toContain('href="https://www.cnam.fr"');
    });
  });
});
