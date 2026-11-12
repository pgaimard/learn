import { Folder } from './file.service';
import { childrenOf, flattenTree, isInside, pathTo } from './folder-tree';

const FOLDERS: Folder[] = [
  { id: 1, parentId: null, name: 'TD' },
  { id: 2, parentId: 1, name: 'Corrigés' },
  { id: 3, parentId: null, name: 'Annales' },
  { id: 4, parentId: 2, name: '2024' },
];

describe('childrenOf', () => {
  it('donne les dossiers de la racine ou d’un dossier', () => {
    expect(childrenOf(FOLDERS, null).map((folder) => folder.name)).toEqual(['TD', 'Annales']);
    expect(childrenOf(FOLDERS, 1).map((folder) => folder.name)).toEqual(['Corrigés']);
    expect(childrenOf(FOLDERS, 4)).toEqual([]);
  });
});

describe('pathTo', () => {
  it('est vide à la racine', () => {
    expect(pathTo(FOLDERS, null)).toEqual([]);
  });

  it('remonte de la racine jusqu’au dossier', () => {
    expect(pathTo(FOLDERS, 4)?.map((folder) => folder.name)).toEqual(['TD', 'Corrigés', '2024']);
  });

  it('signale un dossier inconnu', () => {
    expect(pathTo(FOLDERS, 99)).toBeNull();
  });

  it('ne boucle pas sur des données incohérentes', () => {
    const cycle: Folder[] = [
      { id: 1, parentId: 2, name: 'A' },
      { id: 2, parentId: 1, name: 'B' },
    ];

    expect(pathTo(cycle, 1)?.length).toBeLessThanOrEqual(3);
  });
});

describe('flattenTree', () => {
  it('fait suivre chaque dossier de ses sous-dossiers, avec leur profondeur', () => {
    expect(flattenTree(FOLDERS).map((entry) => [entry.folder.name, entry.depth])).toEqual([
      ['TD', 0],
      ['Corrigés', 1],
      ['2024', 2],
      ['Annales', 0],
    ]);
  });
});

describe('isInside', () => {
  it('reconnaît un dossier lui-même et ses descendants, à toute profondeur', () => {
    expect(isInside(FOLDERS, 1, 1)).toBe(true);
    expect(isInside(FOLDERS, 2, 1)).toBe(true);
    expect(isInside(FOLDERS, 4, 1)).toBe(true);
  });

  it('écarte un ancêtre, un dossier d’une autre branche et un dossier inconnu', () => {
    expect(isInside(FOLDERS, 1, 2)).toBe(false);
    expect(isInside(FOLDERS, 3, 1)).toBe(false);
    expect(isInside(FOLDERS, 99, 1)).toBe(false);
  });

  it('ne boucle pas sur des données incohérentes', () => {
    const loop: Folder[] = [
      { id: 1, parentId: 2, name: 'A' },
      { id: 2, parentId: 1, name: 'B' },
    ];

    expect(isInside(loop, 1, 9)).toBe(false);
  });
});
