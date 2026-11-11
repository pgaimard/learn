import { Editor } from '@tiptap/core';
import { ContentNode } from '../../content/content-node';
import { createCourseExtensions } from '../../content/course-extensions';
import {
  blockAt,
  canMoveBlock,
  canTransformBlock,
  deleteBlock,
  dropBlock,
  duplicateBlock,
  moveBlock,
  transformBlock,
} from './block-commands';

function paragraph(text: string): ContentNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

const TABLE: ContentNode = {
  type: 'table',
  content: [
    {
      type: 'tableRow',
      content: [{ type: 'tableCell', content: [paragraph('cellule')] }],
    },
  ],
};

describe('commandes de bloc', () => {
  let editor: Editor;

  function setup(...blocks: ContentNode[]): void {
    editor = new Editor({
      extensions: createCourseExtensions(),
      content: { type: 'doc', content: blocks },
    });
  }

  // Position du bloc de premier niveau de rang donné.
  function posOf(index: number): number {
    let pos = 0;
    for (let rank = 0; rank < index; rank++) {
      pos += editor.state.doc.child(rank).nodeSize;
    }
    return pos;
  }

  function outline(): string[] {
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

  afterEach(() => editor.destroy());

  it('retrouve le bloc de premier niveau qui contient une position', () => {
    setup(paragraph('un'), TABLE, paragraph('trois'));

    expect(blockAt(editor.state.doc, posOf(1) + 5)).toMatchObject({ index: 1, pos: posOf(1) });
    expect(blockAt(editor.state.doc, posOf(2))?.node.textContent).toBe('trois');
    expect(blockAt(editor.state.doc, editor.state.doc.content.size)).toBeNull();
  });

  it('monte et descend un bloc, tableau compris', () => {
    setup(paragraph('un'), TABLE, paragraph('trois'));

    expect(moveBlock(editor, posOf(1), -1)).toBe(true);
    expect(outline()).toEqual(['table:cellule', 'paragraph:un', 'paragraph:trois']);

    expect(moveBlock(editor, posOf(0), 1)).toBe(true);
    expect(moveBlock(editor, posOf(1), 1)).toBe(true);
    expect(outline()).toEqual(['paragraph:un', 'paragraph:trois', 'table:cellule']);
  });

  it('garde le curseur dans le bloc déplacé', () => {
    setup(paragraph('un'), paragraph('deux'));
    editor.commands.setTextSelection(posOf(1) + 3);

    moveBlock(editor, posOf(1), -1);

    expect(blockAt(editor.state.doc, editor.state.selection.from)?.node.textContent).toBe('deux');
  });

  it('ne déplace pas au-delà des extrémités', () => {
    setup(paragraph('un'), paragraph('deux'));

    expect(canMoveBlock(editor, posOf(0), -1)).toBe(false);
    expect(canMoveBlock(editor, posOf(1), 1)).toBe(false);
    expect(moveBlock(editor, posOf(0), -1)).toBe(false);
    expect(outline()).toEqual(['paragraph:un', 'paragraph:deux']);
  });

  it('dépose un tableau ailleurs sans en laisser une copie vide', () => {
    setup(paragraph('un'), TABLE, paragraph('trois'));
    const table = blockAt(editor.state.doc, posOf(1));

    const transaction = table && dropBlock(editor.state, table, 0);
    expect(transaction).not.toBeNull();
    if (transaction) {
      editor.view.dispatch(transaction);
    }

    expect(outline()).toEqual(['table:cellule', 'paragraph:un', 'paragraph:trois']);
  });

  it('dépose un bloc plus bas, à la position visée après son retrait', () => {
    setup(paragraph('un'), paragraph('deux'), paragraph('trois'));
    const first = blockAt(editor.state.doc, 0);

    const transaction = first && dropBlock(editor.state, first, editor.state.doc.content.size);
    if (transaction) {
      editor.view.dispatch(transaction);
    }

    expect(outline()).toEqual(['paragraph:deux', 'paragraph:trois', 'paragraph:un']);
  });

  it('ignore un dépôt du bloc sur lui-même', () => {
    setup(paragraph('un'), paragraph('deux'));
    const first = blockAt(editor.state.doc, 0);

    expect(first && dropBlock(editor.state, first, 2)).toBeNull();
    expect(first && dropBlock(editor.state, first, posOf(1))).toBeNull();
  });

  it('duplique un bloc juste en dessous', () => {
    setup(paragraph('un'), TABLE);

    duplicateBlock(editor, posOf(1));

    expect(outline()).toEqual(['paragraph:un', 'table:cellule', 'table:cellule']);
  });

  it('supprime un bloc, et laisse un paragraphe vide si c’était le dernier', () => {
    setup(paragraph('un'), paragraph('deux'));

    deleteBlock(editor, posOf(0));
    expect(outline()).toEqual(['paragraph:deux']);

    deleteBlock(editor, posOf(0));
    expect(outline()).toEqual(['paragraph:']);
  });

  it('transforme un paragraphe en titre, en liste ou en encadré', () => {
    setup(paragraph('un'), paragraph('deux'), paragraph('trois'), paragraph('quatre'));

    transformBlock(editor, posOf(0), { kind: 'heading', level: 5 });
    transformBlock(editor, posOf(1), { kind: 'bulletList' });
    transformBlock(editor, posOf(2), { kind: 'callout', callout: 'attention' });
    transformBlock(editor, posOf(3), { kind: 'codeBlock' });

    expect(outline()).toEqual([
      'heading:un',
      'bulletList:deux',
      'callout:trois',
      'codeBlock:quatre',
    ]);
    expect(editor.state.doc.child(0).attrs['level']).toBe(5);
    expect(editor.state.doc.child(2).attrs['kind']).toBe('attention');
  });

  it('ramène un titre à un paragraphe', () => {
    setup({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Titre' }] });

    transformBlock(editor, posOf(0), { kind: 'paragraph' });

    expect(outline()).toEqual(['paragraph:Titre']);
  });

  it('ne transforme pas un tableau', () => {
    setup(TABLE);

    expect(canTransformBlock(editor, posOf(0))).toBe(false);
    expect(transformBlock(editor, posOf(0), { kind: 'paragraph' })).toBe(false);
    expect(outline()).toEqual(['table:cellule']);
  });

  it('monte le bloc du curseur avec Alt+Maj+↑', () => {
    editor = new Editor({
      extensions: createCourseExtensions({
        blockHandle: { onOpenMenu: () => undefined },
        tableTools: { onOpenMenu: () => undefined },
        selection: { onChange: () => undefined },
      }),
      content: { type: 'doc', content: [paragraph('un'), paragraph('deux')] },
    });
    editor.commands.setTextSelection(posOf(1) + 1);

    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, shiftKey: true, bubbles: true }),
    );

    expect(outline()).toEqual(['paragraph:deux', 'paragraph:un']);
  });
});
