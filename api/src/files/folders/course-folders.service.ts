import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { isEntryName, isForbidden } from '../entry-name.js';
import { nextFreeName } from '../file-name.js';
import { FileStorageService } from '../file-storage.service.js';
import { StoredFile } from '../stored-file.entity.js';
import { Folder } from './folder.entity.js';

const MAX_NAME_LENGTH = 255;
const FALLBACK_NAME = 'Cours';
const SOURCE_MIME_TYPE = 'application/octet-stream';

// Ce que le dossier a besoin de savoir de son cours.
export interface FolderOwner {
  id: number;
  ueId: number;
  title: string;
}

export interface CourseFolderSummary {
  id: number;
  name: string;
  // Fichiers et sous-dossiers contenus, à tous les niveaux.
  fileCount: number;
  folderCount: number;
}

// Fichiers écrits sur disque et fichiers remplacés lors d'un dépôt dans le dossier d'un
// cours : les premiers sont à effacer si l'opération échoue, les seconds si elle réussit.
export interface StoredSources {
  written: string[];
  replaced: string[];
}

// Le dossier du cours $1 et tous ses sous-dossiers, avec leur profondeur.
const TREE_CTE = `
  WITH RECURSIVE tree AS (
    SELECT id, 0 AS depth FROM folders WHERE course_id = $1
    UNION ALL
    SELECT child.id, tree.depth + 1
      FROM folders child
      JOIN tree ON child.parent_id = tree.id
  )`;

// Nom de dossier tiré du titre d'un cours : un titre peut contenir « / », pas un dossier.
export function folderNameOf(title: string): string {
  const name = Array.from(title)
    .map((character) => (isForbidden(character) ? ' ' : character))
    .join('')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return isEntryName(name) ? name : FALLBACK_NAME;
}

// Dossier de fichiers d'un cours : créé avec lui à la racine de l'UE, il suit son titre.
// Les écritures passent par le gestionnaire reçu, pour entrer dans la transaction du cours.
@Injectable()
export class CourseFoldersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: FileStorageService,
  ) {}

  // Donne son dossier au cours. Un dossier libre qui porte déjà son nom devient le sien.
  async attach(manager: EntityManager, course: FolderOwner): Promise<Folder> {
    const current = await manager.findOneBy(Folder, { courseId: course.id });
    if (current) {
      return current;
    }
    const name = folderNameOf(course.title);
    const roots = await this.rootFolders(manager, course.ueId);
    const namesake = roots.find(
      (folder) =>
        folder.courseId === null &&
        folder.name.toLowerCase() === name.toLowerCase(),
    );
    if (namesake) {
      namesake.courseId = course.id;
      return manager.save(namesake);
    }
    return manager.save(
      manager.create(Folder, {
        ueId: course.ueId,
        parentId: null,
        name: nextFreeName(
          name,
          roots.map((folder) => folder.name),
        ),
        courseId: course.id,
      }),
    );
  }

  // Aligne le nom du dossier sur le titre du cours ; un nom déjà pris est numéroté.
  async rename(manager: EntityManager, course: FolderOwner): Promise<void> {
    const folder = await this.attach(manager, course);
    const name = folderNameOf(course.title);
    if (folder.name === name) {
      return;
    }
    const others = (await this.rootFolders(manager, course.ueId)).filter(
      (other) => other.id !== folder.id,
    );
    folder.name = nextFreeName(
      name,
      others.map((other) => other.name),
    );
    await manager.save(folder);
  }

  async describe(courseId: number): Promise<CourseFolderSummary | null> {
    const rows = await this.dataSource.query<CourseFolderSummary[]>(
      `${TREE_CTE}
       SELECT root.id, root.name,
              (SELECT count(*)::int FROM files
                WHERE folder_id IN (SELECT id FROM tree)) AS "fileCount",
              (SELECT count(*)::int FROM tree WHERE depth > 0) AS "folderCount"
         FROM folders root
        WHERE root.course_id = $1`,
      [courseId],
    );
    return rows[0] ?? null;
  }

  // Supprime le dossier du cours avec tout ce qu'il contient. Renvoie les noms de stockage
  // des fichiers, à effacer du disque une fois la transaction validée.
  async removeTree(
    manager: EntityManager,
    courseId: number,
  ): Promise<string[]> {
    const tree = await manager.query<{ id: number; depth: number }[]>(
      `${TREE_CTE} SELECT id, depth FROM tree ORDER BY depth DESC`,
      [courseId],
    );
    if (tree.length === 0) {
      return [];
    }
    const ids = tree.map((folder) => folder.id);
    const files = await manager.query<{ storage_name: string }[]>(
      'SELECT storage_name FROM files WHERE folder_id = ANY($1)',
      [ids],
    );
    await manager.query('DELETE FROM files WHERE folder_id = ANY($1)', [ids]);
    // Un dossier ne se supprime qu'une fois vide : les plus profonds d'abord.
    for (const { id } of tree) {
      await manager.query('DELETE FROM folders WHERE id = $1', [id]);
    }
    return files.map((file) => file.storage_name);
  }

  // Dépose des fichiers dans le dossier du cours ; un fichier de même nom est remplacé.
  async storeSources(
    manager: EntityManager,
    course: FolderOwner,
    sources: Map<string, Buffer>,
    stored: StoredSources,
  ): Promise<void> {
    if (sources.size === 0) {
      return;
    }
    const folder = await this.attach(manager, course);
    for (const [name, data] of sources) {
      const previous = await manager
        .createQueryBuilder(StoredFile, 'file')
        // Le nom de stockage n'est pas lu par défaut.
        .addSelect('file.storageName')
        .where('file.folder_id = :folderId', { folderId: folder.id })
        .andWhere('lower(file.name) = lower(:name)', { name })
        .getOne();
      if (previous) {
        await manager.delete(StoredFile, { id: previous.id });
        stored.replaced.push(previous.storageName);
      }
      const storageName = randomUUID();
      await this.storage.write(storageName, data);
      stored.written.push(storageName);
      await manager.save(
        manager.create(StoredFile, {
          ueId: course.ueId,
          folderId: folder.id,
          name,
          storageName,
          mimeType: SOURCE_MIME_TYPE,
          size: data.length,
        }),
      );
    }
  }

  async removeStored(storageNames: string[]): Promise<void> {
    await Promise.all(storageNames.map((name) => this.storage.remove(name)));
  }

  private rootFolders(manager: EntityManager, ueId: number): Promise<Folder[]> {
    return manager.findBy(Folder, { ueId, parentId: IsNull() });
  }
}
