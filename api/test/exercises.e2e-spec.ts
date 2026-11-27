import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Course } from '../src/courses/course.entity.js';
import { ExerciseAttempt } from '../src/exercises/exercise-attempt.entity.js';
import { ExerciseProgress } from '../src/exercises/exercises.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

function answer(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

describe('Réponses aux exercices', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let courseId: number;
  let base: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    const course = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Processus',
    });
    courseId = (course.body as Course).id;
    base = `/api/courses/${courseId}/exercises`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function progress(key: string): Promise<ExerciseProgress> {
    const response = await client('get', `${base}/${key}`);
    expect(response.status).toBe(200);
    return response.body as ExerciseProgress;
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get(
      `${base}/exercice-1`,
    );

    expect(response.status).toBe(401);
  });

  it('ne connaît ni un cours absent, ni une clé mal formée', async () => {
    expect((await client('get', '/api/courses/9999/exercises/a')).status).toBe(
      404,
    );
    expect((await client('get', `${base}/Exercice%201`)).status).toBe(404);
  });

  it('part d’un exercice sans brouillon ni tentative', async () => {
    expect(await progress('exercice-1')).toEqual({ draft: null, attempts: [] });
  });

  it('garde un seul brouillon, remplacé à chaque enregistrement', async () => {
    await client('put', `${base}/exercice-1/draft`).send({
      answer: answer('Début'),
    });
    const saved = await client('put', `${base}/exercice-1/draft`).send({
      answer: answer('Début de réponse'),
    });

    expect(saved.status).toBe(200);
    const { draft, attempts } = await progress('exercice-1');
    expect(draft?.answer).toEqual(answer('Début de réponse'));
    expect(draft?.submittedAt).toBeNull();
    expect(attempts).toEqual([]);
  });

  it('refuse un brouillon dont le contenu n’est pas autorisé', async () => {
    const response = await client('put', `${base}/exercice-1/draft`).send({
      answer: { type: 'doc', content: [{ type: 'script' }] },
    });

    expect(response.status).toBe(400);
  });

  it('valide la réponse : le brouillon devient une tentative, puis se note', async () => {
    const submitted = await client('post', `${base}/exercice-1/attempts`).send({
      kind: 'exercise',
      answer: answer('Réponse finale'),
    });

    expect(submitted.status).toBe(201);
    const attempt = submitted.body as ExerciseAttempt;
    expect(attempt.submittedAt).not.toBeNull();
    expect(attempt.score).toBeNull();
    expect((await progress('exercice-1')).draft).toBeNull();

    const graded = await client(
      'patch',
      `/api/exercise-attempts/${attempt.id}`,
    ).send({ score: 14.5 });

    expect(graded.status).toBe(200);
    expect(graded.body).toMatchObject({ score: 14.5, maxScore: 20 });
    const { attempts } = await progress('exercice-1');
    expect(attempts).toEqual([
      expect.objectContaining({ id: attempt.id, score: 14.5, maxScore: 20 }),
    ]);
    // L'historique ne porte pas les réponses : elles se lisent une à une.
    expect(attempts[0]).not.toHaveProperty('answer');
    const full = await client('get', `/api/exercise-attempts/${attempt.id}`);
    expect((full.body as ExerciseAttempt).answer).toEqual(
      answer('Réponse finale'),
    );
  });

  it('refuse une note hors de 0 à 20, ou qui n’est pas au demi-point', async () => {
    const { attempts } = await progress('exercice-1');
    const path = `/api/exercise-attempts/${attempts[0].id}`;

    expect((await client('patch', path).send({ score: 21 })).status).toBe(400);
    expect((await client('patch', path).send({ score: 12.3 })).status).toBe(
      400,
    );
    expect((await client('patch', path).send({})).status).toBe(400);
  });

  it('range les tentatives de la plus récente à la plus ancienne', async () => {
    await client('post', `${base}/exercice-1/attempts`).send({
      kind: 'exercise',
      answer: answer('Seconde réponse'),
    });

    const { attempts } = await progress('exercice-1');

    expect(attempts).toHaveLength(2);
    expect(attempts[0].score).toBeNull();
    expect(attempts[1].score).toBe(14.5);
  });

  it('enregistre le score d’un QCM, sans brouillon', async () => {
    const submitted = await client('post', `${base}/qcm-1/attempts`).send({
      kind: 'quiz',
      score: 6,
      maxScore: 8,
    });

    expect(submitted.status).toBe(201);
    expect(submitted.body).toMatchObject({
      kind: 'quiz',
      score: 6,
      maxScore: 8,
      answer: null,
    });
    const tooHigh = await client('post', `${base}/qcm-1/attempts`).send({
      kind: 'quiz',
      score: 9,
      maxScore: 8,
    });
    expect(tooHigh.status).toBe(400);
    // Le score d'un QCM ne se retouche pas.
    const regraded = await client(
      'patch',
      `/api/exercise-attempts/${(submitted.body as ExerciseAttempt).id}`,
    ).send({ score: 8 });
    expect(regraded.status).toBe(400);
  });

  it('supprime les réponses avec le cours', async () => {
    const dataSource = app.get(DataSource);
    const count = async (): Promise<number> =>
      Number(
        (
          await dataSource.query<{ count: string }[]>(
            'SELECT count(*) FROM exercise_attempts',
          )
        )[0].count,
      );
    expect(await count()).toBe(3);

    await client('delete', `/api/courses/${courseId}`);

    expect(await count()).toBe(0);
  });
});
