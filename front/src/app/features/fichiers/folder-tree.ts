import { Folder } from './file.service';

// Sous-dossiers directs d'un dossier, ou dossiers de la racine quand parentId est null.
export function childrenOf(folders: Folder[], parentId: number | null): Folder[] {
  return folders.filter((folder) => folder.parentId === parentId);
}

// Chemin de la racine jusqu'au dossier, celui-ci compris ; null si le dossier est inconnu.
export function pathTo(folders: Folder[], folderId: number | null): Folder[] | null {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: Folder[] = [];
  let current = folderId;
  // La borne protège d'une boucle si les données étaient incohérentes.
  while (current !== null && path.length <= folders.length) {
    const folder = byId.get(current);
    if (!folder) {
      return null;
    }
    path.unshift(folder);
    current = folder.parentId;
  }
  return path;
}

export interface TreeEntry {
  folder: Folder;
  // Profondeur dans l'arborescence : 0 pour un dossier de la racine.
  depth: number;
}

// Tous les dossiers dans l'ordre d'affichage d'une arborescence : chaque dossier est
// suivi de ses sous-dossiers.
export function flattenTree(
  folders: Folder[],
  parentId: number | null = null,
  depth = 0,
): TreeEntry[] {
  if (depth > folders.length) {
    return [];
  }
  return childrenOf(folders, parentId).flatMap((folder) => [
    { folder, depth },
    ...flattenTree(folders, folder.id, depth + 1),
  ]);
}
