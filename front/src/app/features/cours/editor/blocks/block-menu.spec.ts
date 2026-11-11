import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import { ContentNode } from '../../content/content-node';
import { createCourseExtensions } from '../../content/course-extensions';
import { BlockMenu } from './block-menu';

function paragraph(text: string): ContentNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

describe('BlockMenu', () => {
  let fixture: ComponentFixture<BlockMenu>;
  let editor: Editor;
  let closed: number;

  function setup(pos: number, ...blocks: ContentNode[]): void {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: { type: 'doc', content: blocks },
    });
    fixture = TestBed.createComponent(BlockMenu);
    fixture.componentRef.setInput('editor', editor);
    fixture.componentRef.setInput('pos', pos);
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.body.append(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(element().querySelectorAll('button')).find((candidate) =>
      candidate.textContent.trim().startsWith(label),
    ) as HTMLButtonElement;
  }

  function texts(): string[] {
    const blocks: string[] = [];
    editor.state.doc.forEach((node) => {
      blocks.push(`${node.type.name}:${node.textContent}`);
    });
    // L'éditeur garde un paragraphe vide après un dernier bloc qui n'en est pas un.
    if (blocks.length > 1 && blocks.at(-1) === 'paragraph:') {
      blocks.pop();
    }
    return blocks;
  }

  afterEach(() => {
    editor.destroy();
    element().remove();
  });

  it('désactive « Monter » sur le premier bloc et « Descendre » sur le dernier', () => {
    setup(0, paragraph('un'), paragraph('deux'));

    expect(button('Monter').disabled).toBe(true);
    expect(button('Descendre').disabled).toBe(false);
  });

  it('descend le bloc puis se ferme', () => {
    setup(0, paragraph('un'), paragraph('deux'));

    button('Descendre').click();

    expect(texts()).toEqual(['paragraph:deux', 'paragraph:un']);
    expect(closed).toBe(1);
  });

  it('duplique et supprime le bloc', () => {
    setup(0, paragraph('un'), paragraph('deux'));

    button('Dupliquer').click();
    expect(texts()).toEqual(['paragraph:un', 'paragraph:un', 'paragraph:deux']);

    button('Supprimer').click();
    expect(texts()).toEqual(['paragraph:un', 'paragraph:deux']);
  });

  it('transforme un paragraphe par le menu', () => {
    setup(0, paragraph('un'));

    button('Sous-section').click();

    expect(texts()).toEqual(['heading:un']);
    expect(editor.state.doc.child(0).attrs['level']).toBe(3);
  });

  it('ne propose pas de transformer une image ou un tableau', () => {
    setup(0, { type: 'horizontalRule' }, paragraph('un'));

    expect(element().textContent).not.toContain('Transformer en');
    expect(button('Dupliquer')).toBeDefined();
  });

  it('épingle le bloc à la fiche de révision, puis propose de le retirer', () => {
    setup(0, paragraph('un'));

    button('Épingler à la fiche de révision').click();
    expect(editor.getJSON().content?.[0].attrs).toEqual({ pinned: true });

    fixture.componentRef.setInput('pos', 0);
    fixture = TestBed.createComponent(BlockMenu);
    fixture.componentRef.setInput('editor', editor);
    fixture.componentRef.setInput('pos', 0);
    document.body.append(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
    expect(button('Retirer de la fiche de révision')).toBeDefined();
  });

  it('ne propose pas d’épingler un titre', () => {
    setup(0, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Titre' }] });

    expect(element().textContent).not.toContain('fiche de révision');
  });

  it('se ferme avec Échap ou par un clic en dehors', () => {
    setup(0, paragraph('un'));

    element().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button('Dupliquer').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(closed).toBe(2);
  });

  it('se parcourt avec les flèches', () => {
    setup(0, paragraph('un'), paragraph('deux'));
    button('Descendre').focus();

    element().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));

    expect(document.activeElement).toBe(button('Épingler à la fiche de révision'));
  });
});
