import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import { UploadedImageResponse } from '../src/courses/images/image-http.js';
import { Term } from '../src/terms/term.entity.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const SVG_WITH_SCRIPT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">' +
  '<script>alert(2)</script><rect width="10" height="10"/></svg>';

function doc(src: string, alt = ''): object {
  return {
    type: 'doc',
    content: [
      { type: 'paragraph' },
      {
        type: 'figure',
        attrs: { src, alt },
        content: [{ type: 'text', text: 'Légende' }],
      },
    ],
  };
}

describe('Images de terme', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let termId: number;
  let otherTermId: number;
  const storageDirectory = join(process.env.UPLOADS_DIR ?? '', 'course-images');

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    const createTerm = async (label: string): Promise<number> => {
      const response = await client('post', '/api/terms').send({
        type: 'definition',
        label,
      });
      return (response.body as Term).id;
    };
    termId = await createTerm('Processus');
    otherTermId = await createTerm('Fil d’exécution');
  });

  afterAll(async () => {
    await app.close();
  });

  async function upload(
    data: Buffer,
    target = `/api/terms/${termId}/images`,
  ): Promise<request.Response> {
    return client('post', target).attach('file', data, 'image');
  }

  async function uploadPng(target?: string): Promise<UploadedImageResponse> {
    return (await upload(PNG, target)).body as UploadedImageResponse;
  }

  function storedFiles(): string[] {
    return existsSync(storageDirectory) ? readdirSync(storageDirectory) : [];
  }

  it('refuse l’envoi et la lecture sans session', async () => {
    const server = app.getHttpServer();

    const sent = await request(server)
      .post(`/api/terms/${termId}/images`)
      .attach('file', PNG, 'capture.png');
    const read = await request(server).get(`/api/terms/${termId}/images/1`);

    expect(sent.status).toBe(401);
    expect(read.status).toBe(401);
  });

  it('enregistre un PNG et le sert avec des en-têtes stricts', async () => {
    const response = await client('post', `/api/terms/${termId}/images`)
      .field('altText', 'États d’un processus')
      .attach('file', PNG, 'capture.png');

    expect(response.status).toBe(201);
    const image = response.body as UploadedImageResponse;
    expect(image).toMatchObject({
      src: `/api/terms/${termId}/images/${image.id}`,
      mimeType: 'image/png',
      altText: 'États d’un processus',
    });

    const served = await client('get', image.src);
    expect(served.status).toBe(200);
    expect(served.get('X-Content-Type-Options')).toBe('nosniff');
    expect(served.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    );
    expect(Buffer.compare(served.body as Buffer, PNG)).toBe(0);
  });

  it('assainit un SVG avant de le stocker', async () => {
    const image = (await upload(Buffer.from(SVG_WITH_SCRIPT)))
      .body as UploadedImageResponse;

    const served = await client('get', image.src).buffer(true);
    const text = (served.body as Buffer).toString('utf8');
    expect(image.mimeType).toBe('image/svg+xml');
    expect(text).toContain('<rect');
    expect(text).not.toContain('script');
    expect(text).not.toContain('onload');
  });

  it('refuse un fichier qui n’est pas une image, un envoi vide et un terme inconnu', async () => {
    const html = await upload(Buffer.from('<html></html>'));
    const empty = await client('post', `/api/terms/${termId}/images`);
    const unknown = await upload(PNG, '/api/terms/9999/images');

    expect(html.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it('ne sert pas l’image d’un terme sous l’adresse d’un autre', async () => {
    const image = await uploadPng();

    const response = await client(
      'get',
      `/api/terms/${otherTermId}/images/${image.id}`,
    );

    expect(response.status).toBe(404);
  });

  it('refuse une image à la création d’un terme', async () => {
    const image = await uploadPng();

    const response = await client('post', '/api/terms').send({
      type: 'definition',
      label: 'Ordonnanceur',
      content: doc(image.src),
    });

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages).toEqual([
      'Les images s’ajoutent une fois le terme créé.',
    ]);
  });

  it('à l’enregistrement, garde les images utilisées et supprime les autres', async () => {
    const kept = await uploadPng();

    const saved = await client('patch', `/api/terms/${termId}`).send({
      content: doc(kept.src, 'Schéma des états'),
    });

    expect(saved.status).toBe(200);
    expect(storedFiles()).toHaveLength(1);
    const rows = await app
      .get(DataSource)
      .query<{ id: number; alt_text: string }[]>(
        'SELECT id, alt_text FROM term_images',
      );
    expect(rows).toEqual([{ id: kept.id, alt_text: 'Schéma des états' }]);
  });

  it('garde les images quand la définition n’est pas modifiée', async () => {
    await client('patch', `/api/terms/${termId}`).send({ label: 'Processus' });

    expect(storedFiles()).toHaveLength(1);
  });

  it('refuse l’image d’un autre terme ou d’un cours', async () => {
    const foreign = await uploadPng(`/api/terms/${otherTermId}/images`);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    const course = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Processus',
    });
    const courseId = (course.body as Course).id;
    const courseImage = await uploadPng(`/api/courses/${courseId}/images`);

    for (const src of [foreign.src, courseImage.src]) {
      const response = await client('patch', `/api/terms/${termId}`).send({
        content: doc(src),
      });
      expect(response.status).toBe(400);
      expect((response.body as ErrorResponse).messages).toEqual([
        'La définition référence une image qui n’appartient pas à ce terme.',
      ]);
    }

    const inCourse = await client('patch', `/api/courses/${courseId}`).send({
      content: doc(foreign.src),
    });
    expect(inCourse.status).toBe(400);
    await client('delete', `/api/courses/${courseId}`);
  });

  it('supprime les fichiers avec le terme', async () => {
    await client('delete', `/api/terms/${termId}`);
    await client('delete', `/api/terms/${otherTermId}`);

    expect(storedFiles()).toEqual([]);
  });
});
