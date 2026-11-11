import { Folder } from './file.service';
import { childrenOf, pathTo } from './folder-tree';

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
