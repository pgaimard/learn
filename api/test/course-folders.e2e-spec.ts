import { NestExpressApplication } from '@nestjs/platform-express';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Course } from '../src/courses/course.entity.js';
import { ImportPreview } from '../src/courses/import/course-import.service.js';
import { FileSummary } from '../src/files/files.service.js';
import { CourseFolderSummary } from '../src/files/folders/course-folders.service.js';
import { FolderSummary } from '../src/files/folders/folders.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { createZip } from './create-zip.js';
import { resetDatabase } from './reset-database.js';

const MARKDOWN = `---
ue: UTC502
titre: Mémoire
ordre: 1
---

## 1. Pagination

La mémoire est découpée en pages.
`;

describe('Dossier de fichiers d’un cours', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  const storageDirectory = join(process.env.UPLOADS_DIR ?? '', 'files');

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCourse(title: string): Promise<number> {
    const response = await client('post', '/api/ues/UTC502/courses').send({
      title,
    });
    expect(response.status).toBe(201);
    return (response.body as Course).id;
  }

  async function folders(): Promise<FolderSummary[]> {
    return (await client('get', '/api/ues/UTC502/folders'))
      .body as FolderSummary[];
  }

  async function folderOf(courseId: number): Promise<CourseFolderSummary> {
    const response = await client('get', `/api/courses/${courseId}/folder`);
    expect(response.status).toBe(200);
    return response.body as CourseFolderSummary;
  }

  async function upload(folderId: number, name: string): Promise<void> {
    const response = await client('post', '/api/ues/UTC502/files')
      .field('folderId', String(folderId))
      .attach('file', Buffer.from('contenu'), name);
    expect(response.status).toBe(201);
  }

  async function filesOf(folderId: number): Promise<FileSummary[]> {
    return (await client('get', `/api/ues/UTC502/files?folder=${folderId}`))
      .body as FileSummary[];
  }

  function importPackage(
    extra: Record<string, Buffer | string>,
    replace = false,
  ) {
    return client('post', '/api/course-imports')
      .field('replace', String(replace))
      .attach(
        'file',
        createZip({ 'cours.md': MARKDOWN, ...extra }),
        'paquet.zip',
      );
  }

  it('crée le dossier avec le cours, à la racine de l’UE', async () => {
    const courseId = await createCourse('Processus / fils');

    expect(await folders()).toEqual([
      expect.objectContaining({
        name: 'Processus   fils',
        parentId: null,
        courseId,
      }),
    ]);
    expect(await folderOf(courseId)).toMatchObject({
      name: 'Processus   fils',
      fileCount: 0,
      folderCount: 0,
    });
    await client('delete', `/api/courses/${courseId}`);
  });

  it('adopte le dossier libre qui porte déjà le nom du cours', async () => {
    const created = await client('post', '/api/ues/UTC502/folders').send({
      name: 'ordonnancement',
    });
    const folderId = (created.body as FolderSummary).id;

    const courseId = await createCourse('Ordonnancement');

    expect((await folderOf(courseId)).id).toBe(folderId);
    await client('delete', `/api/courses/${courseId}`);
  });

  it('renomme le dossier avec le cours, en numérotant un nom déjà pris', async () => {
    const courseId = await createCourse('Brouillon');
    await client('post', '/api/ues/UTC502/folders').send({ name: 'Annales' });

    await client('patch', `/api/courses/${courseId}`).send({
      title: 'Fichiers',
    });
    expect((await folderOf(courseId)).name).toBe('Fichiers');

    await client('patch', `/api/courses/${courseId}`).send({
      title: 'Annales',
    });
    expect((await folderOf(courseId)).name).toBe('Annales - 2');
    await client('delete', `/api/courses/${courseId}`);
  });

  it('refuse de renommer, déplacer ou supprimer à la main le dossier d’un cours', async () => {
    const courseId = await createCourse('Verrou');
    const { id } = await folderOf(courseId);
    const path = `/api/folders/${id}`;

    expect((await client('patch', path).send({ name: 'Autre' })).status).toBe(
      409,
    );
    expect((await client('delete', path)).status).toBe(409);
    await client('delete', `/api/courses/${courseId}`);
  });

  it('garde par défaut le dossier non vide du cours supprimé, comme dossier libre', async () => {
    const courseId = await createCourse('Gardé');
    const { id } = await folderOf(courseId);
    await upload(id, 'notes.txt');

    const removal = await client('delete', `/api/courses/${courseId}`);

    expect(removal.status).toBe(204);
    const kept = (await folders()).find((folder) => folder.id === id);
    expect(kept).toMatchObject({ name: 'Gardé', courseId: null });
    expect(await filesOf(id)).toHaveLength(1);
  });

  it('supprime sur demande le dossier du cours, ses sous-dossiers et leurs fichiers', async () => {
    const before = readdirSync(storageDirectory).length;
    const courseId = await createCourse('Jeté');
    const { id } = await folderOf(courseId);
    const sub = await client('post', '/api/ues/UTC502/folders').send({
      name: 'TD',
      parentId: id,
    });
    const subId = (sub.body as FolderSummary).id;
    await upload(id, 'cours.pdf');
    await upload(subId, 'td.pdf');
    expect(await folderOf(courseId)).toMatchObject({
      fileCount: 2,
      folderCount: 1,
    });

    const removal = await client(
      'delete',
      `/api/courses/${courseId}?folder=delete`,
    );

    expect(removal.status).toBe(204);
    const ids = (await folders()).map((folder) => folder.id);
    expect(ids).not.toContain(id);
    expect(ids).not.toContain(subId);
    expect(readdirSync(storageDirectory)).toHaveLength(before);
  });

  it('refuse un sort de dossier inconnu', async () => {
    const courseId = await createCourse('Sort');

    const response = await client(
      'delete',
      `/api/courses/${courseId}?folder=oui`,
    );

    expect(response.status).toBe(400);
    await client('delete', `/api/courses/${courseId}`);
  });

  it('range les documents de sources/ dans le dossier du cours importé', async () => {
    const zip = {
      'sources/Chapitre 3.pdf': Buffer.from('%PDF-1'),
      'sources/notes.txt': 'première version',
    };
    const preview = await client('post', '/api/course-imports/preview').attach(
      'file',
      createZip({ 'cours.md': MARKDOWN, ...zip }),
      'paquet.zip',
    );
    expect((preview.body as ImportPreview).sourceCount).toBe(2);

    const imported = await importPackage(zip);

    expect(imported.status).toBe(201);
    const courseId = (imported.body as Course).id;
    const folder = await folderOf(courseId);
    expect(folder).toMatchObject({ name: 'Mémoire', fileCount: 2 });
    expect(
      (await filesOf(folder.id)).map((file) => [file.name, file.size]),
    ).toEqual([
      ['Chapitre 3.pdf', 6],
      ['notes.txt', 17],
    ]);
  });

  it('au réimport, remplace le document de même nom et garde les autres', async () => {
    const before = readdirSync(storageDirectory).length;

    const imported = await importPackage(
      { 'sources/NOTES.txt': 'v2', 'sources/plan.md': '# Plan' },
      true,
    );

    expect(imported.status).toBe(201);
    const folder = await folderOf((imported.body as Course).id);
    expect(
      (await filesOf(folder.id)).map((file) => [file.name, file.size]),
    ).toEqual([
      ['Chapitre 3.pdf', 6],
      ['NOTES.txt', 2],
      ['plan.md', 6],
    ]);
    // Un fichier de plus sur disque : l'ancien « notes.txt » a été effacé.
    expect(readdirSync(storageDirectory)).toHaveLength(before + 1);
  });

  it('refuse un document dans un sous-dossier de sources/', async () => {
    const response = await importPackage(
      { 'sources/annexes/a.pdf': 'x' },
      true,
    );

    expect(response.status).toBe(400);
  });
});
