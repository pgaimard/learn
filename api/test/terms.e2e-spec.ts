import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { Course } from '../src/courses/course.entity.js';
import { Term } from '../src/terms/term.entity.js';
import { TermSummary } from '../src/terms/terms.service.js';
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
      type: 'paragraph',
      content: [{ type: 'text', text: 'Programme en cours d’exécution.' }],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'c' },
      content: [{ type: 'text', text: 'pid_t pid = fork();' }],
    },
  ],
};

describe('Termes', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let client: AuthenticatedClient;
  let courseId: number;
  let processId: number;

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
    const course = await client('post', '/api/ues/UTC502/courses').send({
      title: 'Processus',
    });
    courseId = (course.body as Course).id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function listLabels(query = ''): Promise<string[]> {
    const response = await client('get', `/api/terms${query}`);
    expect(response.status).toBe(200);
    return (response.body as TermSummary[]).map((term) => term.label);
  }

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get('/api/terms');

    expect(response.status).toBe(401);
  });

  it('crée une définition rattachée à un cours et à son UE', async () => {
    const response = await client('post', '/api/terms').send({
      type: 'definition',
      label: '  Processus ',
      content: CONTENT,
      courseId,
    });

    expect(response.status).toBe(201);
    const term = response.body as Term;
    processId = term.id;
    expect(term).toMatchObject({
      type: 'definition',
      label: 'Processus',
      expandedForm: null,
      content: CONTENT,
      ue: { code: 'UTC502' },
      course: { id: courseId, title: 'Processus' },
    });
    expect(term).not.toHaveProperty('plainText');
    expect(term.course).not.toHaveProperty('content');
  });

  it('crée un acronyme sans origine, à la définition vide', async () => {
    const response = await client('post', '/api/terms').send({
      type: 'acronym',
      label: 'PID',
      expandedForm: 'Process Identifier',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      expandedForm: 'Process Identifier',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      ue: null,
      course: null,
    });
  });

  it('accepte le même libellé dans le dictionnaire et le glossaire', async () => {
    const response = await client('post', '/api/terms').send({
      type: 'definition',
      label: 'PID',
      ueCode: 'nfe108',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ue: { code: 'NFE108' } });
  });

  it('refuse un doublon sans tenir compte de la casse', async () => {
    const response = await client('post', '/api/terms').send({
      type: 'definition',
      label: 'PROCESSUS',
    });

    expect(response.status).toBe(409);
    expect((response.body as ErrorResponse).messages).toEqual([
      '« PROCESSUS » existe déjà dans le dictionnaire.',
    ]);
  });

  it.each([
    ['un type inconnu', { type: 'note', label: 'X' }],
    ['un libellé vide', { type: 'definition', label: '   ' }],
    ['un acronyme sans forme développée', { type: 'acronym', label: 'CPU' }],
    [
      'une définition avec forme développée',
      { type: 'definition', label: 'X', expandedForm: 'Y' },
    ],
    ['une propriété inconnue', { type: 'definition', label: 'X', id: 3 }],
    ['une UE inconnue', { type: 'definition', label: 'X', ueCode: 'ABC123' }],
    ['un cours inconnu', { type: 'definition', label: 'X', courseId: 9999 }],
    [
      'un cours d’une autre UE',
      { type: 'definition', label: 'X', courseId: 0, ueCode: 'NFE108' },
    ],
    [
      'un contenu hors liste blanche',
      {
        type: 'definition',
        label: 'X',
        content: { type: 'doc', content: [{ type: 'script' }] },
      },
    ],
  ])('refuse %s', async (_label, body) => {
    const input =
      'courseId' in body && body.courseId === 0 ? { ...body, courseId } : body;
    const response = await client('post', '/api/terms').send(input);

    expect(response.status).toBe(400);
  });

  it('liste les termes par ordre alphabétique avec un extrait', async () => {
    await client('post', '/api/terms').send({
      type: 'definition',
      label: 'élément',
    });
    const response = await client('get', '/api/terms?type=definition');

    expect(response.status).toBe(200);
    const terms = response.body as TermSummary[];
    expect(terms.map((term) => term.label)).toEqual([
      'élément',
      'PID',
      'Processus',
    ]);
    expect(terms[2]).toEqual({
      id: processId,
      type: 'definition',
      label: 'Processus',
      expandedForm: null,
      excerpt: 'Programme en cours d’exécution.\npid_t pid = fork();',
      ueCode: 'UTC502',
      courseId,
      courseTitle: 'Processus',
    });
  });

  it('filtre par type et par UE d’origine', async () => {
    expect(await listLabels('?type=acronym')).toEqual(['PID']);
    expect(await listLabels('?ue=UTC502')).toEqual(['Processus']);
    expect(await listLabels('?ue=NFE108&type=acronym')).toEqual([]);
  });

  it('filtre par cours d’origine', async () => {
    const fromCourse = await listLabels(`?course=${courseId}`);

    expect(fromCourse.length).toBeGreaterThan(0);
    expect(fromCourse).not.toEqual(await listLabels(''));
    expect(await listLabels('?course=999999')).toEqual([]);
    expect((await client('get', '/api/terms?course=abc')).status).toBe(400);
  });

  it('refuse un filtre invalide ou une UE inconnue', async () => {
    expect((await client('get', '/api/terms?type=note')).status).toBe(400);
    expect((await client('get', '/api/terms?tri=date')).status).toBe(400);
    expect((await client('get', '/api/terms?ue=ABC123')).status).toBe(404);
  });

  it('renvoie 404 pour un terme inconnu', async () => {
    expect((await client('get', '/api/terms/9999')).status).toBe(404);
    expect((await client('get', '/api/terms/abc')).status).toBe(404);
  });

  it('modifie le libellé et la définition, et met à jour le texte brut', async () => {
    const response = await client('patch', `/api/terms/${processId}`).send({
      label: 'Processus lourd',
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Nouveau.' }] },
        ],
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      label: 'Processus lourd',
      course: { id: courseId },
    });
    const rows = await dataSource.query<{ plain_text: string }[]>(
      'SELECT plain_text FROM terms WHERE id = $1',
      [processId],
    );
    expect(rows[0].plain_text).toBe('Nouveau.');
  });

  it('transforme une définition en acronyme et inversement', async () => {
    const path = `/api/terms/${processId}`;
    expect((await client('patch', path).send({ type: 'acronym' })).status).toBe(
      400,
    );

    const acronym = await client('patch', path).send({
      type: 'acronym',
      expandedForm: 'Forme',
    });
    expect(acronym.body).toMatchObject({
      type: 'acronym',
      expandedForm: 'Forme',
    });

    const definition = await client('patch', path).send({ type: 'definition' });
    expect(definition.body).toMatchObject({
      type: 'definition',
      expandedForm: null,
    });
  });

  it('refuse de renommer un terme en doublon', async () => {
    const response = await client('patch', `/api/terms/${processId}`).send({
      label: 'pid',
    });

    expect(response.status).toBe(409);
  });

  it('détache le terme de son cours puis de son UE', async () => {
    const path = `/api/terms/${processId}`;
    const withoutCourse = await client('patch', path).send({ courseId: null });
    expect(withoutCourse.body).toMatchObject({
      course: null,
      ue: { code: 'UTC502' },
    });

    const withoutUe = await client('patch', path).send({ ueCode: null });
    expect(withoutUe.body).toMatchObject({ course: null, ue: null });
  });

  it('garde le terme quand son cours d’origine est supprimé', async () => {
    const path = `/api/terms/${processId}`;
    await client('patch', path).send({ courseId });
    await client('delete', `/api/courses/${courseId}`);

    const response = await client('get', path);
    expect(response.body).toMatchObject({
      course: null,
      ue: { code: 'UTC502' },
    });
  });

  it('supprime un terme', async () => {
    const path = `/api/terms/${processId}`;
    expect((await client('delete', path)).status).toBe(204);
    expect((await client('get', path)).status).toBe(404);
  });
});
