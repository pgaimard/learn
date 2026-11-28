import { NestExpressApplication } from '@nestjs/platform-express';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import {
  MAX_SNAPSHOTS,
  SnapshotSummary,
} from '../src/courses/snapshots/course-snapshots.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { createZip } from './create-zip.js';
import { resetDatabase } from './reset-database.js';
import { saveCourse } from './save-course.js';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

// Un chapitre « Les processus » dont le texte et le schéma changent d'une version à l'autre.
function chapter(version: string): Buffer {
  return createZip({
    'cours.md': [
      '---',
      'ue: UTC502',
      'titre: Les processus',
      'ordre: 1',
      '---',
      '',
      `## 1. Version ${version}`,
      '',
      `![Schéma ${version}](images/fig-01.svg "Schéma de la version ${version}")`,
    ].join('\n'),
    'images/fig-01.svg': SVG,
    'fiche.md': `## Fiche ${version}`,
  });
}

describe('Instantanés d’un cours', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let course: Course;
  const storageDirectory = join(process.env.UPLOADS_DIR ?? '', 'course-images');

  async function replaceBy(version: string): Promise<request.Response> {
    return client('post', '/api/course-imports')
      .field('replace', 'true')
      .attach('file', chapter(version), 'paquet.zip');
  }

  async function read(): Promise<Course> {
    return (await client('get', `/api/courses/${course.id}`)).body as Course;
  }

  async function list(): Promise<SnapshotSummary[]> {
    const response = await client('get', `/api/courses/${course.id}/snapshots`);
    expect(response.status).toBe(200);
    return response.body as SnapshotSummary[];
  }

  function restore(snapshotId: number, revision: number): request.Test {
    return client(
      'post',
      `/api/courses/${course.id}/snapshots/${snapshotId}/restore`,
    ).send({ revision });
  }

  function messages(response: request.Response): string[] {
    return (response.body as ErrorResponse).messages;
  }

  function imageOf(shown: Course): string {
    return /\/api\/courses\/\d+\/images\/\d+/.exec(
      JSON.stringify(shown.content),
    )![0];
  }

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    const imported = await client('post', '/api/course-imports')
      .field('replace', 'false')
      .attach('file', chapter('A'), 'paquet.zip');
    course = imported.body as Course;
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const server = app.getHttpServer();
    const path = `/api/courses/${course.id}/snapshots`;

    const listed = await request(server).get(path);
    const restored = await request(server)
      .post(`${path}/1/restore`)
      .send({ revision: 1 });

    expect([listed.status, restored.status]).toEqual([401, 401]);
  });

  it('ne garde rien d’un cours qui vient d’être créé, ni d’un enregistrement de l’éditeur', async () => {
    const saved = await saveCourse(client, course.id, { title: course.title });

    expect(saved.status).toBe(200);
    expect(await list()).toEqual([]);
    expect((await client('get', '/api/courses/9999/snapshots')).status).toBe(
      404,
    );
  });

  it('garde le chapitre et ses images avant son remplacement par un paquet', async () => {
    const before = await read();

    const replaced = await replaceBy('B');

    expect(replaced.status).toBe(201);
    expect(await list()).toEqual([
      {
        id: expect.any(Number) as number,
        origin: 'package',
        revision: before.revision,
        title: 'Les processus',
        createdAt: expect.any(String) as string,
      },
    ]);
    // Le schéma de la version A reste sur le disque, à côté de celui de la version B.
    expect(readdirSync(storageDirectory)).toHaveLength(2);
    expect((await client('get', imageOf(before))).status).toBe(200);
  });

  it('refuse de restaurer à partir d’une révision dépassée, d’un cours en édition ou d’une version inconnue', async () => {
    const [snapshot] = await list();
    const { revision } = await read();

    const stale = await restore(snapshot.id, revision - 1);
    await client('put', `/api/courses/${course.id}/editing`);
    const editing = await restore(snapshot.id, revision);
    await client('delete', `/api/courses/${course.id}/editing`);
    const unknown = await restore(9999, revision);
    const withoutRevision = await client(
      'post',
      `/api/courses/${course.id}/snapshots/${snapshot.id}/restore`,
    ).send({});

    expect([stale.status, editing.status]).toEqual([409, 409]);
    expect(messages(editing)).toEqual([
      'Ce cours est ouvert dans l’éditeur. Fermez-le avant de le modifier autrement.',
    ]);
    expect([unknown.status, withoutRevision.status]).toEqual([404, 400]);
    expect(JSON.stringify((await read()).content)).toContain('Version B');
    expect(await list()).toHaveLength(1);
  });

  it('refuse l’instantané d’un autre cours', async () => {
    const other = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Mémoire',
    });
    const [snapshot] = await list();

    const response = await client(
      'post',
      `/api/courses/${(other.body as Course).id}/snapshots/${snapshot.id}/restore`,
    ).send({ revision: 1 });

    expect(response.status).toBe(404);
    await client('delete', `/api/courses/${(other.body as Course).id}`);
  });

  it('restaure le texte, la fiche et les images, en gardant d’abord l’état remplacé', async () => {
    const [snapshot] = await list();
    const current = await read();

    const response = await restore(snapshot.id, current.revision);

    expect(response.status).toBe(200);
    const restored = response.body as Course;
    expect(restored.revision).toBe(current.revision + 1);
    expect(JSON.stringify(restored.content)).toContain('Version A');
    expect(JSON.stringify(restored.sheetContent)).toContain('Fiche A');
    expect((await client('get', imageOf(restored))).status).toBe(200);
    const found = await client('get', '/api/search?q=Version');
    expect(JSON.stringify(found.body)).toContain('Version');
    expect((await list()).map((kept) => kept.origin)).toEqual([
      'restore',
      'package',
    ]);
    // La version B reste restaurable : son schéma n'est pas effacé.
    expect(readdirSync(storageDirectory)).toHaveLength(2);
  });

  it('revient à la version remplacée en restaurant l’instantané de la restauration', async () => {
    const [undo] = await list();

    const response = await restore(undo.id, (await read()).revision);

    expect(response.status).toBe(200);
    expect(JSON.stringify((response.body as Course).content)).toContain(
      'Version B',
    );
  });

  it(`ne garde que les ${MAX_SNAPSHOTS.package} derniers instantanés de chaque origine et efface les images qui ne servent plus`, async () => {
    for (let version = 1; version <= MAX_SNAPSHOTS.package + 2; version++) {
      expect((await replaceBy(`n${version}`)).status).toBe(201);
    }

    const all = await list();
    const kept = all.filter((snapshot) => snapshot.origin === 'package');

    expect(kept).toHaveLength(MAX_SNAPSHOTS.package);
    // La rotation se fait par origine : les instantanés d'avant restauration restent.
    expect(all.length - kept.length).toBeGreaterThan(0);
    // Une image pour la version en place, une par instantané gardé.
    expect(readdirSync(storageDirectory)).toHaveLength(all.length + 1);
  });

  it('supprime les instantanés et leurs images avec le cours', async () => {
    const removed = await client('delete', `/api/courses/${course.id}`);
    const [{ count }] = await app
      .get(DataSource)
      .query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM course_snapshots',
      );

    expect(removed.status).toBe(204);
    expect(count).toBe(0);
    expect(readdirSync(storageDirectory)).toHaveLength(0);
  });
});
