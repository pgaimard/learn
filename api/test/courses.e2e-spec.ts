import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '1. Processus' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Un programme en exécution.' }],
    },
  ],
};

describe('Cours', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let client: AuthenticatedClient;
  let courseId: number;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(dataSource);
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    await client('post', '/api/ues').send({
      code: 'NFE108',
      title: 'Méthodes',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function readPlainText(id: number): Promise<string> {
    const rows = await dataSource.query<{ plain_text: string }[]>(
      'SELECT plain_text FROM courses WHERE id = $1',
      [id],
    );
    return rows[0].plain_text;
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/ues/UTC502/courses',
    );

    expect(response.status).toBe(401);
  });

  it('crée un cours vide à la suite des autres', async () => {
    const response = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Introduction',
    });

    expect(response.status).toBe(201);
    const course = response.body as Course;
    expect(course).toMatchObject({
      title: 'Introduction',
      position: 1,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      ue: { code: 'UTC502' },
    });
    expect(course).not.toHaveProperty('plainText');
    courseId = course.id;
  });

  it('crée un cours avec son contenu et en dérive le texte brut', async () => {
    const response = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Processus',
      content: CONTENT,
    });

    expect(response.status).toBe(201);
    const course = response.body as Course;
    expect(course.position).toBe(2);
    expect(await readPlainText(course.id)).toBe(
      '1. Processus\nUn programme en exécution.',
    );
  });

  it('refuse un contenu hors liste blanche', async () => {
    const response = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Piégé',
      content: {
        type: 'doc',
        content: [{ type: 'script', attrs: { src: 'https://evil.example' } }],
      },
    });

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages).toEqual([
      'Bloc non autorisé : « script ».',
    ]);
  });

  it('refuse un titre vide', async () => {
    const response = await client('post', '/api/ues/UTC502/courses').send({
      title: ' ',
    });

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages).toContain(
      'Le titre est requis.',
    );
  });

  it('ne laisse plus fixer l’ordre à la création ni à la modification', async () => {
    const created = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Doublon',
      position: 1,
    });
    const updated = await client('patch', `/api/courses/${courseId}`).send({
      position: 5,
    });

    expect(created.status).toBe(400);
    expect(updated.status).toBe(400);
  });

  it('numérote les cours de chaque UE séparément', async () => {
    const response = await client('post', '/api/ues/NFE108/courses').send({
      title: 'Merise',
    });

    expect(response.status).toBe(201);
    expect((response.body as Course).position).toBe(1);
  });

  it('réordonne les cours d’une UE selon la liste reçue', async () => {
    const before = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];
    const reversed = before.map((course) => course.id).reverse();

    const response = await client('put', '/api/ues/UTC502/courses/order').send({
      ids: reversed,
    });

    expect(response.status).toBe(200);
    expect((response.body as Course[]).map((course) => course.id)).toEqual(
      reversed,
    );
    expect(
      (response.body as Course[]).map((course) => course.position),
    ).toEqual(reversed.map((_id, index) => index + 1));

    await client('put', '/api/ues/UTC502/courses/order').send({
      ids: before.map((course) => course.id),
    });
  });

  it('refuse un ordre incomplet, en double, ou avec le cours d’une autre UE', async () => {
    const mine = (
      (await client('get', '/api/ues/UTC502/courses')).body as Course[]
    ).map((course) => course.id);
    const [foreign] = (await client('get', '/api/ues/NFE108/courses'))
      .body as Course[];
    const reorder = (ids: unknown): request.Test =>
      client('put', '/api/ues/UTC502/courses/order').send({ ids });

    expect((await reorder(mine.slice(1))).status).toBe(400);
    expect((await reorder([...mine, mine[0]])).status).toBe(400);
    expect((await reorder([...mine.slice(1), foreign.id])).status).toBe(400);
    expect((await reorder(['un', 'deux'])).status).toBe(400);
    expect(
      (await client('put', '/api/ues/ABC123/courses/order').send({ ids: [] }))
        .status,
    ).toBe(404);
  });

  it('répond 404 pour une UE inconnue', async () => {
    const response = await client('post', '/api/ues/ABC123/courses').send({
      title: 'Orphelin',
    });

    expect(response.status).toBe(404);
  });

  it('liste les cours d’une UE dans l’ordre, sans leur contenu', async () => {
    const response = await client('get', '/api/ues/UTC502/courses');

    expect(response.status).toBe(200);
    const courses = response.body as Course[];
    expect(courses.map((course) => course.title)).toEqual([
      'Introduction',
      'Processus',
    ]);
    expect(courses[0]).not.toHaveProperty('content');
  });

  it('compte les sections de chaque cours : ses titres de premier niveau', async () => {
    const response = await client('get', '/api/ues/UTC502/courses');

    const sections = (
      response.body as (Course & { sectionCount: number })[]
    ).map((course) => [course.title, course.sectionCount]);
    expect(sections).toEqual([
      ['Introduction', 0],
      ['Processus', 1],
    ]);
  });

  it('enregistre un nouveau contenu et met à jour le texte brut', async () => {
    const response = await client('patch', `/api/courses/${courseId}`).send({
      content: CONTENT,
    });

    expect(response.status).toBe(200);
    expect((response.body as Course).title).toBe('Introduction');
    expect((response.body as Course).content).toEqual(CONTENT);
    expect(await readPlainText(courseId)).toContain(
      'Un programme en exécution.',
    );
  });

  it('refuse d’enregistrer un contenu hors liste blanche', async () => {
    const response = await client('patch', `/api/courses/${courseId}`).send({
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'clic',
                marks: [
                  { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(response.status).toBe(400);
    const stored = await client('get', `/api/courses/${courseId}`);
    expect((stored.body as Course).content).toEqual(CONTENT);
  });

  it('accepte un cours de plus de 100 ko', async () => {
    const paragraph = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'x'.repeat(1000) }],
    };
    const response = await client('patch', `/api/courses/${courseId}`).send({
      content: { type: 'doc', content: Array<object>(200).fill(paragraph) },
    });

    expect(response.status).toBe(200);
  });

  it.each(['999999', 'abc'])('répond 404 pour le cours « %s »', async (id) => {
    const response = await client('get', `/api/courses/${id}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorResponse).messages).toEqual([
      'Ce cours n’existe pas.',
    ]);
  });

  it('n’accepte un QCM que dans les exercices du cours, pas dans son texte ni sa fiche', async () => {
    const [course] = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];
    const path = `/api/courses/${course.id}`;
    const choice = (correct: boolean): Record<string, unknown> => ({
      type: 'quizChoice',
      attrs: { correct },
      content: [{ type: 'text', text: 'oui' }],
    });
    const exercises = {
      type: 'doc',
      content: [
        {
          type: 'quiz',
          attrs: { title: 'Bases' },
          content: [
            {
              type: 'quizQuestion',
              content: [
                { type: 'quizPrompt', content: [{ type: 'paragraph' }] },
                choice(true),
                choice(false),
                { type: 'quizExplanation', content: [{ type: 'paragraph' }] },
              ],
            },
          ],
        },
      ],
    };

    const saved = await client('patch', path).send({
      exercisesContent: exercises,
    });

    expect(saved.status).toBe(200);
    expect((saved.body as Course).exercisesContent).toEqual(exercises);
    const inCourse = await client('patch', path).send({ content: exercises });
    const inSheet = await client('patch', path).send({
      sheetContent: exercises,
    });
    expect(inCourse.status).toBe(400);
    expect(inSheet.status).toBe(400);
    expect((inCourse.body as { messages: string[] }).messages).toEqual([
      'Un QCM ou un exercice se place dans les exercices du cours, pas ailleurs.',
    ]);

    const removed = await client('patch', path).send({
      exercisesContent: null,
    });
    expect((removed.body as Course).exercisesContent).toBeNull();
  });

  it('enregistre, remplace et supprime la fiche de révision sans toucher au cours', async () => {
    const [course] = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];
    const before = (await client('get', `/api/courses/${course.id}`))
      .body as Course;
    expect(before.sheetContent).toBeNull();
    const sheet = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { kind: 'definition' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Fiche.' }] },
          ],
        },
      ],
    };

    const saved = await client('patch', `/api/courses/${course.id}`).send({
      sheetContent: sheet,
    });

    expect(saved.status).toBe(200);
    expect((saved.body as Course).sheetContent).toEqual(sheet);
    expect((saved.body as Course).content).toEqual(before.content);

    const invalid = await client('patch', `/api/courses/${course.id}`).send({
      sheetContent: { type: 'doc', content: [{ type: 'script' }] },
    });
    const foreign = await client('patch', `/api/courses/${course.id}`).send({
      sheetContent: {
        type: 'doc',
        content: [
          {
            type: 'figure',
            attrs: { src: '/api/courses/9999/images/1', alt: '' },
          },
        ],
      },
    });
    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(400);

    const removed = await client('patch', `/api/courses/${course.id}`).send({
      sheetContent: null,
    });
    expect((removed.body as Course).sheetContent).toBeNull();
  });

  it('pose, déplace et retire le marque-page sans toucher à la date de modification', async () => {
    const [course] = (await client('get', '/api/ues/UTC502/courses'))
      .body as (Course & { hasBookmark: boolean })[];
    expect(course.hasBookmark).toBe(false);

    const set = await client('put', `/api/courses/${course.id}/bookmark`).send({
      title: '1.1 États',
      block: 4,
    });
    const moved = await client(
      'put',
      `/api/courses/${course.id}/bookmark`,
    ).send({ title: '2. Ordonnancement', block: 9 });

    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({
      bookmarkTitle: '1.1 États',
      bookmarkBlock: 4,
    });
    expect(moved.body).toMatchObject({
      bookmarkTitle: '2. Ordonnancement',
      bookmarkBlock: 9,
      updatedAt: course.updatedAt,
    });
    const listed = (await client('get', '/api/ues/UTC502/courses'))
      .body as (Course & { hasBookmark: boolean })[];
    expect(listed[0].hasBookmark).toBe(true);

    const removed = await client(
      'delete',
      `/api/courses/${course.id}/bookmark`,
    );

    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({
      bookmarkTitle: null,
      bookmarkBlock: null,
    });
  });

  it('refuse un marque-page invalide ou sur un cours inconnu', async () => {
    const [course] = (await client('get', '/api/ues/UTC502/courses'))
      .body as Course[];
    const invalid = await client(
      'put',
      `/api/courses/${course.id}/bookmark`,
    ).send({ title: 'x', block: -1 });
    const unknown = await client('put', '/api/courses/9999/bookmark').send({
      title: 'x',
      block: 0,
    });
    const anonymous = await request(app.getHttpServer()).delete(
      `/api/courses/${course.id}/bookmark`,
    );

    expect(invalid.status).toBe(400);
    expect(unknown.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });

  it('refuse de supprimer une UE qui contient des cours', async () => {
    const response = await client('delete', '/api/ues/UTC502');

    expect(response.status).toBe(409);
    expect((response.body as ErrorResponse).messages).toEqual([
      'L’UE UTC502 n’est pas vide : supprimez d’abord ses cours, ses termes, ses dossiers et ses fichiers.',
    ]);
  });

  it('supprime un cours', async () => {
    const removal = await client('delete', `/api/courses/${courseId}`);

    expect(removal.status).toBe(204);
    expect((await client('get', `/api/courses/${courseId}`)).status).toBe(404);
  });
});
