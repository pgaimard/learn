import { NestExpressApplication } from '@nestjs/platform-express';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { DatabaseDumper } from '../src/exports/database-dumper.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const DUMP = 'export de la base, pour le test';
const PDF = Buffer.from('%PDF-1.7 contenu de test');
const STAMP = String.raw`\d{4}-\d{2}-\d{2}T\d{4}Z`;

// pg_dump n'est installé que dans l'image de l'API : ici, l'export de la base est simulé.
// Le vrai est vérifié dans la pile Docker (voir docs/restauration.md).
const fakeDumper = {
  dumpTo: (path: string) => writeFile(path, DUMP),
};

describe('Export', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let work: string;

  function authorize(password: string): request.Test {
    return client('post', '/api/exports/authorization').send({ password });
  }

  function messages(response: request.Response): string[] {
    return (response.body as ErrorResponse).messages;
  }

  function download(): request.Test {
    return client('get', '/api/exports')
      .buffer(true)
      .parse((incoming, done) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('end', () => done(null, Buffer.concat(chunks)));
      });
  }

  function tar(...args: string[]): string {
    return execFileSync('tar', args, { cwd: work }).toString();
  }

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(DatabaseDumper).useValue(fakeDumper),
    );
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    await client('post', '/api/ues/UTC502/files').attach('file', PDF, {
      filename: 'sujet.pdf',
      contentType: 'application/pdf',
    });
    work = mkdtempSync(join(tmpdir(), 'learn-export-test-'));
  });

  afterAll(async () => {
    rmSync(work, { recursive: true, force: true });
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const server = app.getHttpServer();

    const authorized = await request(server)
      .post('/api/exports/authorization')
      .send({ password: 'mot de passe long' });
    const read = await request(server).get('/api/exports');

    expect([authorized.status, read.status]).toEqual([401, 401]);
  });

  it('refuse le téléchargement tant que le mot de passe n’est pas confirmé', async () => {
    const response = await client('get', '/api/exports');

    expect(response.status).toBe(403);
    expect(messages(response)).toEqual([
      'Confirmez votre mot de passe pour exporter les données.',
    ]);
  });

  it('refuse une demande sans mot de passe', async () => {
    const response = await client('post', '/api/exports/authorization').send(
      {},
    );

    expect(response.status).toBe(400);
  });

  it('refuse un mauvais mot de passe, sans fermer la session', async () => {
    const refused = await authorize('mauvais');

    expect(refused.status).toBe(403);
    expect(messages(refused)).toEqual(['Mot de passe incorrect.']);
    expect((await client('get', '/api/exports')).status).toBe(403);
    expect((await client('get', '/api/auth/me')).status).toBe(200);
  });

  it('livre une fois l’export de la base et les fichiers, aux noms de la sauvegarde', async () => {
    expect((await authorize('mot de passe long')).status).toBe(204);

    const response = await download();

    expect(response.status).toBe(200);
    expect(response.get('Content-Type')).toBe('application/x-tar');
    expect(response.get('Cache-Control')).toBe('private, no-store');
    const name = new RegExp(`^attachment; filename="learn-(${STAMP})\\.tar"$`);
    const stamp = name.exec(response.get('Content-Disposition') ?? '')?.[1];
    expect(stamp).toBeDefined();

    writeFileSync(join(work, 'export.tar'), response.body as Buffer);
    expect(tar('-tf', 'export.tar').trim().split('\n')).toEqual([
      `learn-${stamp}.dump`,
      `learn-${stamp}-uploads.tar.gz`,
    ]);
    tar('-xf', 'export.tar');
    expect(readFileSync(join(work, `learn-${stamp}.dump`), 'utf8')).toBe(DUMP);
    const uploads = tar('-tzf', `learn-${stamp}-uploads.tar.gz`)
      .trim()
      .split('\n');
    expect(uploads).toContain('uploads/files/');
    expect(
      uploads.filter((entry) => /^uploads\/files\/[^/]+$/.test(entry)),
    ).toHaveLength(1);

    // L'accord ne vaut que pour un téléchargement.
    expect((await client('get', '/api/exports')).status).toBe(403);
  });
});
