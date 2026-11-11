import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ErrorResponse } from '../src/common/http-error.filter.js';
import { AgendaEvent } from '../src/events/event.entity.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

const WEEK = '?from=2026-11-16T00:00:00Z&to=2026-11-23T00:00:00Z';

function occurrence(day: string, start = '18:00', end = '21:00'): object {
  return { startsAt: `${day}T${start}:00Z`, endsAt: `${day}T${end}:00Z` };
}

describe('Événements', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let courseEventId: number;

  async function create(body: object): Promise<request.Response> {
    return client('post', '/api/events').send(body);
  }

  async function titles(query: string): Promise<string[]> {
    const response = await client('get', `/api/events${query}`);
    expect(response.status).toBe(200);
    return (response.body as AgendaEvent[]).map((event) => event.title);
  }

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

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/events${WEEK}`,
    );

    expect(response.status).toBe(401);
  });

  it('crée un événement par occurrence, rattaché à l’UE', async () => {
    const response = await create({
      title: '  Cours UTC502 ',
      type: 'course',
      ueCode: 'utc502',
      occurrences: [
        occurrence('2026-11-17'),
        occurrence('2026-11-24'),
        occurrence('2026-12-01'),
      ],
    });

    expect(response.status).toBe(201);
    const events = response.body as AgendaEvent[];
    courseEventId = events[0].id;
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      title: 'Cours UTC502',
      type: 'course',
      ue: { code: 'UTC502' },
      startsAt: '2026-11-17T18:00:00.000Z',
      endsAt: '2026-11-17T21:00:00.000Z',
    });
  });

  it('crée une échéance ponctuelle, sans UE', async () => {
    const response = await create({
      title: 'Rendu du projet',
      type: 'deadline',
      occurrences: [occurrence('2026-11-20', '23:00', '23:00')],
    });

    expect(response.status).toBe(201);
    expect((response.body as AgendaEvent[])[0]).toMatchObject({
      ue: null,
      type: 'deadline',
    });
  });

  it.each([
    ['un titre vide', { title: ' ' }],
    ['un type inconnu', { type: 'examen' }],
    ['une UE inconnue', { ueCode: 'ABC123' }],
    ['aucune occurrence', { occurrences: [] }],
    [
      'une occurrence mal formée',
      { occurrences: [{ startsAt: 'lundi', endsAt: 'mardi' }] },
    ],
    [
      'une occurrence incomplète',
      { occurrences: [{ startsAt: '2026-11-17T18:00:00Z' }] },
    ],
    [
      'une occurrence avec une propriété inconnue',
      { occurrences: [{ ...occurrence('2026-11-17'), id: 1 }] },
    ],
    [
      'une fin avant le début',
      { occurrences: [occurrence('2026-11-17', '21:00', '18:00')] },
    ],
    [
      'plus de 60 occurrences',
      {
        occurrences: Array.from({ length: 61 }, () => occurrence('2026-11-17')),
      },
    ],
  ])('refuse %s', async (_label, changes) => {
    const response = await create({
      title: 'Cours',
      type: 'course',
      occurrences: [occurrence('2026-11-17')],
      ...changes,
    });

    expect(response.status).toBe(400);
  });

  it('ne crée rien quand une seule occurrence est invalide', async () => {
    await create({
      title: 'Série refusée',
      type: 'course',
      occurrences: [
        occurrence('2026-11-18'),
        occurrence('2026-11-19', '21:00', '18:00'),
      ],
    });

    expect(await titles(WEEK)).not.toContain('Série refusée');
  });

  it('liste les événements qui recoupent la période, dans l’ordre', async () => {
    expect(await titles(WEEK)).toEqual(['Cours UTC502', 'Rendu du projet']);
    expect(await titles(`${WEEK}&ue=UTC502`)).toEqual(['Cours UTC502']);
    expect(
      await titles('?from=2026-11-17T20:00:00Z&to=2026-11-17T20:30:00Z'),
    ).toEqual(['Cours UTC502']);
    expect(
      await titles('?from=2026-11-18T00:00:00Z&to=2026-11-19T00:00:00Z'),
    ).toEqual([]);
  });

  it.each([
    ['sans période', ''],
    [
      'avec une période inversée',
      '?from=2026-11-23T00:00:00Z&to=2026-11-16T00:00:00Z',
    ],
    [
      'avec une période de plus de 62 jours',
      '?from=2026-01-01T00:00:00Z&to=2026-06-01T00:00:00Z',
    ],
    ['avec une date invalide', '?from=lundi&to=2026-11-23T00:00:00Z'],
  ])('refuse une liste %s', async (_label, query) => {
    expect((await client('get', `/api/events${query}`)).status).toBe(400);
  });

  it('renvoie 404 pour une UE inconnue en filtre', async () => {
    expect((await client('get', `/api/events${WEEK}&ue=ABC123`)).status).toBe(
      404,
    );
  });

  it('modifie une occurrence sans toucher aux autres', async () => {
    const response = await client('patch', `/api/events/${courseEventId}`).send(
      {
        title: 'Cours déplacé',
        startsAt: '2026-11-18T18:00:00Z',
        endsAt: '2026-11-18T20:00:00Z',
        ueCode: null,
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      title: 'Cours déplacé',
      type: 'course',
      ue: null,
      startsAt: '2026-11-18T18:00:00.000Z',
    });
    expect(
      await titles('?from=2026-11-23T00:00:00Z&to=2026-12-07T00:00:00Z'),
    ).toEqual(['Cours UTC502', 'Cours UTC502']);
  });

  it('refuse de placer la fin avant le début en modifiant une seule date', async () => {
    const response = await client('patch', `/api/events/${courseEventId}`).send(
      {
        endsAt: '2026-11-18T10:00:00Z',
      },
    );

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponse).messages).toEqual([
      'La fin ne peut pas précéder le début.',
    ]);
  });

  it('renvoie 404 pour un événement inconnu', async () => {
    expect(
      (await client('patch', '/api/events/9999').send({ title: 'X' })).status,
    ).toBe(404);
    expect((await client('delete', '/api/events/abc')).status).toBe(404);
  });

  it('supprime un événement', async () => {
    expect(
      (await client('delete', `/api/events/${courseEventId}`)).status,
    ).toBe(204);
    expect(await titles(WEEK)).toEqual(['Rendu du projet']);
  });
});
