import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import { UploadedImageResponse } from '../src/courses/images/course-images.controller.js';
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

function figure(src: string, alt = '', caption = 'Légende'): object {
  return {
    type: 'figure',
    attrs: { src, alt },
    content: [{ type: 'text', text: caption }],
  };
}

function doc(...content: object[]): object {
  return { type: 'doc', content: [{ type: 'paragraph' }, ...content] };
}

describe('Images de cours', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let courseId: number;
  let otherCourseId: number;
  const storageDirectory = join(process.env.UPLOADS_DIR ?? '', 'course-images');

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    const createCourse = async (title: string): Promise<number> => {
      const response = await client('post', '/api/ues/UTC502/courses').send({
        title,
      });
      return (response.body as Course).id;
    };
    courseId = await createCourse('Processus');
    otherCourseId = await createCourse('Mémoire');
  });

  afterAll(async () => {
    await app.close();
  });

  async function upload(
    data: Buffer,
    filename: string,
    targetCourseId = courseId,
  ): Promise<request.Response> {
    return client('post', `/api/courses/${targetCourseId}/images`).attach(
      'file',
      data,
      filename,
    );
  }

  async function uploadPng(): Promise<UploadedImageResponse> {
    return (await upload(PNG, 'capture.png')).body as UploadedImageResponse;
  }

  function storedFiles(): string[] {
    return existsSync(storageDirectory) ? readdirSync(storageDirectory) : [];
  }

  it('refuse l’envoi et la lecture sans session', async () => {
    const server = app.getHttpServer();

    const sent = await request(server)
      .post(`/api/courses/${courseId}/images`)
      .attach('file', PNG, 'capture.png');
    const read = await request(server).get(`/api/courses/${courseId}/images/1`);

    expect(sent.status).toBe(401);
    expect(read.status).toBe(401);
  });

  it('enregistre un PNG et le sert avec des en-têtes stricts', async () => {
    const response = await client('post', `/api/courses/${courseId}/images`)
      .field('altText', 'Capture du terminal')
      .attach('file', PNG, 'capture.png');

    expect(response.status).toBe(201);
    const image = response.body as UploadedImageResponse;
    expect(image).toMatchObject({
      src: `/api/courses/${courseId}/images/${image.id}`,
      mimeType: 'image/png',
      size: PNG.length,
      altText: 'Capture du terminal',
    });

    const served = await client('get', image.src);
    expect(served.status).toBe(200);
    expect(served.get('Content-Type')).toBe('image/png');
    expect(served.get('X-Content-Type-Options')).toBe('nosniff');
    expect(served.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    );
    expect(Buffer.compare(served.body as Buffer, PNG)).toBe(0);
  });

  it('range le fichier sous un nom généré, sans lien avec le nom d’origine', async () => {
    await upload(PNG, '../../etc/passwd.png');

    const files = storedFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file).toMatch(/^[0-9a-f-]{36}\.(png|jpg|svg)$/);
    }
  });

  it('assainit un SVG avant de le stocker', async () => {
    const response = await upload(Buffer.from(SVG_WITH_SCRIPT), 'schema.svg');

    expect(response.status).toBe(201);
    const image = response.body as UploadedImageResponse;
    expect(image.mimeType).toBe('image/svg+xml');
    const served = await client('get', image.src).buffer(true);
    const svg = (served.body as Buffer).toString('utf8');
    expect(svg).toContain('<rect');
    expect(svg).not.toMatch(/script|onload/);
  });

  it('se fie au contenu du fichier, pas à son extension', async () => {
    const disguised = await upload(
      Buffer.from('<html><script>x</script></html>'),
      'page.png',
    );

    expect(disguised.status).toBe(400);
    expect((disguised.body as ErrorResponse).messages).toEqual([
      'Format non pris en charge : seuls PNG, JPEG et SVG sont acceptés.',
    ]);
  });

  it('refuse une image de plus de 5 Mo', async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

    const response = await upload(tooBig, 'enorme.png');

    expect(response.status).toBe(413);
  });

  it('refuse un envoi sans fichier et un cours inconnu', async () => {
    const empty = await client('post', `/api/courses/${courseId}/images`);
    const unknown = await upload(PNG, 'capture.png', 999999);

    expect(empty.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it('ne sert pas l’image d’un cours sous l’adresse d’un autre', async () => {
    const image = await uploadPng();

    const response = await client(
      'get',
      `/api/courses/${otherCourseId}/images/${image.id}`,
    );

    expect(response.status).toBe(404);
  });

  it('à l’enregistrement, garde les images utilisées et supprime les autres', async () => {
    const kept = await uploadPng();
    const dropped = await uploadPng();

    const saved = await client('patch', `/api/courses/${courseId}`).send({
      content: doc(figure(kept.src, 'Schéma des états')),
    });

    expect(saved.status).toBe(200);
    expect((await client('get', kept.src)).status).toBe(200);
    expect((await client('get', dropped.src)).status).toBe(404);
    expect(storedFiles()).toHaveLength(1);
    const rows = await app
      .get(DataSource)
      .query<{ alt_text: string }[]>(
        'SELECT alt_text FROM course_images WHERE id = $1',
        [kept.id],
      );
    expect(rows[0].alt_text).toBe('Schéma des états');
  });

  it('refuse un contenu qui référence l’image d’un autre cours', async () => {
    const foreign = (await upload(PNG, 'autre.png', otherCourseId))
      .body as UploadedImageResponse;

    const response = await client('patch', `/api/courses/${courseId}`).send({
      content: doc(figure(foreign.src)),
    });

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages).toEqual([
      'Le contenu référence une image qui n’appartient pas à ce cours.',
    ]);
  });

  it.each([
    'https://evil.example/x.png',
    'data:image/png;base64,AAAA',
    '/api/ues',
  ])('refuse une image dont la source est « %s »', async (src) => {
    const response = await client('patch', `/api/courses/${courseId}`).send({
      content: doc(figure(src)),
    });

    expect(response.status).toBe(400);
  });

  it('supprime les fichiers avec le cours', async () => {
    await upload(PNG, 'autre.png', otherCourseId);

    await client('delete', `/api/courses/${courseId}`);
    await client('delete', `/api/courses/${otherCourseId}`);

    expect(storedFiles()).toEqual([]);
  });
});
