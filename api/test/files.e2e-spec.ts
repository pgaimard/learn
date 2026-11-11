import { NestExpressApplication } from '@nestjs/platform-express';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { FileSummary } from '../src/files/files.service.js';
import { FolderSummary } from '../src/files/folders/folders.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const PDF = Buffer.from('%PDF-1.7 contenu de test');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

describe('Fichiers', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let tdId: number;
  let otherUeFolderId: number;
  const storageDirectory = join(process.env.UPLOADS_DIR ?? '', 'files');

  async function createFolder(name: string, ue = 'UTC502'): Promise<number> {
    const response = await client('post', `/api/ues/${ue}/folders`).send({
      name,
    });
    return (response.body as FolderSummary).id;
  }

  function upload(
    name: string,
    folderId?: number,
    data = PDF,
    ue = 'UTC502',
  ): request.Test {
    const sent = client('post', `/api/ues/${ue}/files`);
    if (folderId !== undefined) {
      void sent.field('folderId', String(folderId));
    }
    return sent.attach('file', data, {
      filename: name,
      contentType: 'application/pdf',
    });
  }

  async function uploaded(
    name: string,
    folderId?: number,
  ): Promise<FileSummary> {
    const response = await upload(name, folderId);
    expect(response.status).toBe(201);
    return response.body as FileSummary;
  }

  async function names(folderId?: number): Promise<string[]> {
    const query = folderId === undefined ? '' : `?folder=${folderId}`;
    const response = await client('get', `/api/ues/UTC502/files${query}`);
    expect(response.status).toBe(200);
    return (response.body as FileSummary[]).map((file) => file.name);
  }

  function messages(response: request.Response): string[] {
    return (response.body as ErrorResponse).messages;
  }

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    await client('post', '/api/ues').send({
      code: 'NFE108',
      title: 'Méthodes',
    });
    tdId = await createFolder('TD');
    otherUeFolderId = await createFolder('Annales', 'NFE108');
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const server = app.getHttpServer();

    const listed = await request(server).get('/api/ues/UTC502/files');
    const sent = await request(server)
      .post('/api/ues/UTC502/files')
      .attach('file', PDF, 'a.pdf');
    const read = await request(server).get('/api/files/1/download');

    expect([listed.status, sent.status, read.status]).toEqual([401, 401, 401]);
  });

  it('enregistre un fichier à la racine, sous son nom accentué', async () => {
    const file = await uploaded('Corrigé TD3.pdf');

    expect(file).toEqual({
      id: expect.any(Number) as number,
      folderId: null,
      name: 'Corrigé TD3.pdf',
      mimeType: 'application/pdf',
      size: PDF.length,
      updatedAt: expect.any(String) as string,
    });
    expect(file).not.toHaveProperty('storageName');
  });

  it('range le contenu sous un nom généré, sans lien avec le nom reçu', async () => {
    await uploaded('../../etc/passwd');

    expect(await names()).toEqual(['Corrigé TD3.pdf', 'passwd']);
    for (const stored of readdirSync(storageDirectory)) {
      expect(stored).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('numérote un nom déjà pris au lieu de remplacer le fichier', async () => {
    const second = await uploaded('corrigé td3.PDF');
    const third = await uploaded('Corrigé TD3.pdf');

    expect(second.name).toBe('corrigé td3 - 2.PDF');
    expect(third.name).toBe('Corrigé TD3 - 3.pdf');
    expect(await names()).toHaveLength(4);
  });

  it('range un fichier dans un dossier, où le même nom reste libre', async () => {
    const file = await uploaded('Corrigé TD3.pdf', tdId);

    expect(file).toMatchObject({ folderId: tdId, name: 'Corrigé TD3.pdf' });
    expect(await names(tdId)).toEqual(['Corrigé TD3.pdf']);
  });

  it('refuse un envoi sans fichier, un dossier inconnu ou d’une autre UE', async () => {
    const empty = await client('post', '/api/ues/UTC502/files');
    const unknownFolder = await upload('a.pdf', 9999);
    const foreignFolder = await upload('a.pdf', otherUeFolderId);
    const unknownUe = await upload('a.pdf', undefined, PDF, 'ABC123');

    expect(empty.status).toBe(400);
    expect(unknownFolder.status).toBe(400);
    expect(foreignFolder.status).toBe(400);
    expect(unknownUe.status).toBe(404);
  });

  it('refuse un fichier de plus de 50 Mo sans rien garder sur le disque', async () => {
    const before = readdirSync(storageDirectory).length;

    const response = await upload(
      'gros.bin',
      undefined,
      Buffer.alloc(50 * 1024 * 1024 + 1),
    );

    expect(response.status).toBe(413);
    expect(readdirSync(storageDirectory)).toHaveLength(before);
  });

  it('sert un fichier en pièce jointe, sans jamais l’afficher', async () => {
    const page = (await upload('page élève.html', undefined, HTML))
      .body as FileSummary;

    const response = await client('get', `/api/files/${page.id}/download`)
      .buffer(true)
      .parse((incoming, done) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('end', () => done(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.get('Content-Type')).toBe('application/octet-stream');
    expect(response.get('Content-Disposition')).toBe(
      'attachment; filename="page _l_ve.html"; filename*=UTF-8\'\'page%20%C3%A9l%C3%A8ve.html',
    );
    expect(response.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.get('Content-Security-Policy')).toContain('sandbox');
    expect(Buffer.compare(response.body as Buffer, HTML)).toBe(0);
  });

  it('renvoie 404 pour un fichier inconnu', async () => {
    expect((await client('get', '/api/files/9999/download')).status).toBe(404);
    expect((await client('get', '/api/files/abc/download')).status).toBe(404);
    expect((await client('delete', '/api/files/9999')).status).toBe(404);
  });

  it('renomme un fichier, et refuse un nom déjà pris ou invalide', async () => {
    const file = await uploaded('notes.txt');
    const path = `/api/files/${file.id}`;

    const renamed = await client('patch', path).send({
      name: ' Notes de cours.txt ',
    });
    const taken = await client('patch', path).send({ name: 'PASSWD' });
    const invalid = await client('patch', path).send({ name: 'a/b.txt' });

    expect(renamed.body).toMatchObject({
      name: 'Notes de cours.txt',
      folderId: null,
    });
    expect(taken.status).toBe(409);
    expect(messages(taken)).toEqual([
      'Un fichier « PASSWD » existe déjà dans ce dossier.',
    ]);
    expect(invalid.status).toBe(400);
  });

  it('déplace un fichier, en numérotant son nom s’il est pris à l’arrivée', async () => {
    const [atRoot] = (
      (await client('get', '/api/ues/UTC502/files')).body as FileSummary[]
    ).filter((file) => file.name === 'Corrigé TD3.pdf');

    const moved = await client('patch', `/api/files/${atRoot.id}`).send({
      folderId: tdId,
    });

    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({
      folderId: tdId,
      name: 'Corrigé TD3 - 2.pdf',
    });
    expect(await names(tdId)).toEqual([
      'Corrigé TD3 - 2.pdf',
      'Corrigé TD3.pdf',
    ]);

    const back = await client('patch', `/api/files/${atRoot.id}`).send({
      folderId: null,
    });
    // À la racine, « corrigé td3 - 2.PDF » existe déjà : le nom est numéroté à nouveau.
    expect(back.body).toMatchObject({
      folderId: null,
      name: 'Corrigé TD3 - 2 - 2.pdf',
    });
  });

  it('refuse de déplacer vers un dossier inconnu ou d’une autre UE', async () => {
    const file = await uploaded('a.txt');
    const path = `/api/files/${file.id}`;

    expect((await client('patch', path).send({ folderId: 9999 })).status).toBe(
      400,
    );
    expect(
      (await client('patch', path).send({ folderId: otherUeFolderId })).status,
    ).toBe(400);
    expect((await client('patch', path).send({ ueId: 2 })).status).toBe(400);
  });

  it('refuse de supprimer un dossier ou une UE qui contient des fichiers', async () => {
    const folder = await client('delete', `/api/folders/${tdId}`);
    const ue = await client('delete', '/api/ues/UTC502');

    expect(folder.status).toBe(409);
    expect(messages(folder)).toEqual([
      'Le dossier « TD » n’est pas vide : il contient 0 sous-dossier(s) et 1 fichier(s).',
    ]);
    expect(ue.status).toBe(409);
  });

  it('supprime un fichier et son contenu', async () => {
    const before = readdirSync(storageDirectory).length;
    const file = await uploaded('à supprimer.txt');

    expect((await client('delete', `/api/files/${file.id}`)).status).toBe(204);

    expect(readdirSync(storageDirectory)).toHaveLength(before);
    expect((await client('get', `/api/files/${file.id}/download`)).status).toBe(
      404,
    );
  });
});
