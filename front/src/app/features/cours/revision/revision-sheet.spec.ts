import { ContentNode } from '../content/content-node';
import { hasSheetContent, sheetBlocks, sheetHeadingIndexes } from './revision-sheet';

const heading = (level: number): ContentNode => ({ type: 'heading', attrs: { level } });
const text: ContentNode = { type: 'paragraph', attrs: { pinned: false } };
const pinned: ContentNode = { type: 'table', attrs: { pinned: true } };
const retenir: ContentNode = { type: 'callout', attrs: { kind: 'retenir', pinned: false } };
const attention: ContentNode = { type: 'callout', attrs: { kind: 'attention', pinned: false } };

describe('fiche de révision', () => {
  it('garde les encadrés « À retenir » et les blocs épinglés, pas le reste', () => {
    expect(sheetBlocks([text, retenir, attention, pinned])).toEqual([false, true, false, true]);
  });

  it('garde un encadré d’un autre type quand il est épinglé', () => {
    const pinnedWarning = { type: 'callout', attrs: { kind: 'attention', pinned: true } };

    expect(sheetBlocks([pinnedWarning])).toEqual([true]);
  });

  it('ne garde que les titres qui mènent à un bloc gardé', () => {
    const blocks = [
      heading(2), // 0 : chapitre avec un sous-chapitre utile
      text,
      heading(3), // 2 : sous-chapitre vide pour la fiche
      text,
      heading(3), // 4 : sous-chapitre avec un bloc épinglé
      pinned,
      heading(2), // 6 : chapitre sans rien pour la fiche
      text,
      heading(3), // 8
      attention,
    ];

    expect(sheetBlocks(blocks)).toEqual([
      true,
      false,
      false,
      false,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('ne rattache pas à un sous-chapitre le bloc gardé du chapitre suivant', () => {
    expect(sheetBlocks([heading(3), text, heading(2), retenir])).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('traite comme non épinglé un contenu ancien, sans attribut', () => {
    expect(sheetBlocks([{ type: 'paragraph' }, { type: 'figure', attrs: null }])).toEqual([
      false,
      false,
    ]);
  });

  it('réduit le sommaire aux titres de la fiche', () => {
    const document: ContentNode = {
      type: 'doc',
      content: [heading(2), text, heading(3), retenir, heading(2), text],
    };

    expect([...sheetHeadingIndexes(document)]).toEqual([0, 1]);
  });

  it('compte les titres placés dans un encadré gardé ou non', () => {
    const calloutWithHeading = (kind: string): ContentNode => ({
      type: 'callout',
      attrs: { kind, pinned: false },
      content: [heading(4), text],
    });
    const document: ContentNode = {
      type: 'doc',
      content: [calloutWithHeading('attention'), heading(2), calloutWithHeading('retenir')],
    };

    // Rang 0 : titre de l'encadré écarté ; 1 : le chapitre ; 2 : titre de l'encadré gardé.
    expect([...sheetHeadingIndexes(document)]).toEqual([1, 2]);
  });

  it('sait quand la fiche est vide', () => {
    expect(hasSheetContent({ type: 'doc', content: [heading(2), text] })).toBe(false);
    expect(hasSheetContent({ type: 'doc', content: [heading(2), retenir] })).toBe(true);
    expect(hasSheetContent({ type: 'doc' })).toBe(false);
  });
});
