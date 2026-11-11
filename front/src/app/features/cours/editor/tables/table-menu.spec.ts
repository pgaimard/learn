import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import { ContentNode } from '../../content/content-node';
import { createCourseExtensions } from '../../content/course-extensions';
import { TableMenu } from './table-menu';

function cell(text: string, type = 'tableCell'): ContentNode {
  return { type, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

describe('TableMenu', () => {
  let fixture: ComponentFixture<TableMenu>;
  let editor: Editor;
  let closed: number;

  function setup(cursorIn: string): void {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              { type: 'tableRow', content: [cell('A', 'tableHeader'), cell('B', 'tableHeader')] },
              { type: 'tableRow', content: [cell('a1'), cell('b1')] },
            ],
          },
        ],
      },
    });
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === cursorIn) {
        editor.commands.setTextSelection(pos);
      }
    });
    fixture = TestBed.createComponent(TableMenu);
    fixture.componentRef.setInput('editor', editor);
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.body.append(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    ) as HTMLButtonElement;
  }

  function grid(): string[] {
    const rows: string[] = [];
    editor.state.doc.child(0).forEach((row) => {
      const cells: string[] = [];
      row.forEach((tableCell) =>
        cells.push(`${tableCell.type.name === 'tableHeader' ? '*' : ''}${tableCell.textContent}`),
      );
      rows.push(cells.join('|'));
    });
    return rows;
  }

  afterEach(() => {
    editor.destroy();
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('insère une ligne et une colonne autour de la cellule du curseur', () => {
    setup('a1');

    button('Insérer au-dessus').click();
    button('Insérer à droite').click();

    expect(grid()).toEqual(['*A|*|*B', '||', 'a1||b1']);
    expect(closed).toBe(2);
  });

  it('déplace la colonne du curseur et désactive les déplacements impossibles', () => {
    setup('a1');

    expect(button('Déplacer à gauche').disabled).toBe(true);
    expect(button('Déplacer vers le bas').disabled).toBe(true);
    expect(button('Déplacer à droite').disabled).toBe(false);

    button('Déplacer à droite').click();

    expect(grid()).toEqual(['*B|*A', 'b1|a1']);
  });

  it('supprime la ligne, la colonne ou le tableau', () => {
    setup('b1');

    button('Supprimer la colonne').click();
    expect(grid()).toEqual(['*A', 'a1']);

    button('Supprimer le tableau').click();
    expect(editor.state.doc.child(0).type.name).toBe('paragraph');
  });

  it('bascule la ligne d’en-tête', () => {
    setup('a1');

    button('Ligne d’en-tête : oui / non').click();

    expect(grid()).toEqual(['A|B', 'a1|b1']);
  });

  it('se ferme avec Échap ou par un clic en dehors', () => {
    setup('a1');

    (fixture.nativeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(closed).toBe(2);
  });
});
