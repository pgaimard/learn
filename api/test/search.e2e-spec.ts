import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Course } from '../src/courses/course.entity.js';
import {
  ExcerptSegment,
  HIGHLIGHT_START,
  HIGHLIGHT_STOP,
} from '../src/search/parse-excerpt.js';
import { SearchResults } from '../src/search/search.service.js';
import {
  AuthenticatedClient,
  createAuthenticatedClient,
} from './authenticated-client.js';
import { createTestApp } from './create-test-app.js';
import { resetDatabase } from './reset-database.js';

function doc(...paragraphs: string[]): object {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

function highlighted(excerpt: ExcerptSegment[]): string[] {
  return excerpt
    .filter((segment) => segment.highlighted)
    .map((segment) => segment.text);
}

describe('Recherche', () => {
  let app: NestExpressApplication;
  let client: AuthenticatedClient;
  let memoryCourseId: number;
  let folderId: number;

  async function createCourse(title: string, content: object): Promise<number> {
    const created = await client('post', '/api/ues/UTC502/courses').send({
      title,
    });
    const id = (created.body as Course).id;
    await client('patch', `/api/courses/${id}`).send({ content });
    return id;
  }

  async function search(q: string): Promise<SearchResults> {
    const response = await client('get', '/api/search').query({ q });
    expect(response.status).toBe(200);
    return response.body as SearchResults;
  }

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app.get(DataSource));
    client = await createAuthenticatedClient(app);
    await client('post', '/api/ues').send({
      code: 'UTC502',
      title: 'Systèmes',
    });
    memoryCourseId = await createCourse(
      'La mémoire virtuelle',
      doc(
        'Chaque processus dispose de son espace d’adressage.',
        'La pagination découpe les mémoires en pages <b>fixes</b>.',
      ),
    );
    await createCourse(
      'Les processus',
      doc('Un processus est un programme en cours d’exécution.'),
    );
    const folder = await client('post', '/api/ues/UTC502/folders').send({
      name: 'TD',
    });
    folderId = (folder.body as { id: number }).id;
    await client('post', '/api/ues/UTC502/files')
      .field('folderId', String(folderId))
      .attach('file', Buffer.from('x'), 'TD3_Mémoire-corrigé.pdf');
    await client('post', '/api/ues/UTC502/files').attach(
      'file',
      Buffer.from('x'),
      'annales.zip',
    );
    await client('post', '/api/terms').send({
      type: 'definition',
      label: 'Pagination',
      content: doc('Découpage de la mémoire en pages de taille fixe.'),
    });
    await client('post', '/api/terms').send({
      type: 'acronym',
      label: 'MMU',
      expandedForm: 'Memory Management Unit',
      content: doc('Circuit qui traduit les adresses.'),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès sans session', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/search?q=memoire',
    );

    expect(response.status).toBe(401);
  });

  it('trouve sans tenir compte des accents, de la casse ni du pluriel', async () => {
    const results = await search('MEMOIRE');

    expect(results.courses.total).toBe(1);
    expect(results.courses.items[0]).toMatchObject({
      id: memoryCourseId,
      title: 'La mémoire virtuelle',
      ueCode: 'UTC502',
    });
    expect(highlighted(results.courses.items[0].excerpt)).toEqual(['mémoires']);
    expect(results.definitions.items.map((term) => term.label)).toEqual([
      'Pagination',
    ]);
    expect(results.acronyms).toEqual({ total: 0, items: [] });
  });

  it('trouve un fichier par un mot de son nom, quels que soient les séparateurs', async () => {
    const byWord = await search('memoire');
    const byPrefix = await search('td3 corr');

    expect(byWord.files).toEqual({
      total: 1,
      items: [
        {
          id: expect.any(Number) as number,
          name: 'TD3_Mémoire-corrigé.pdf',
          ueCode: 'UTC502',
          folderId,
          folderName: 'TD',
          excerpt: [],
        },
      ],
    });
    expect(byPrefix.files.total).toBe(1);
  });

  it('indique un fichier rangé à la racine de l’UE', async () => {
    const [file] = (await search('annales')).files.items;

    expect(file).toMatchObject({ folderId: null, folderName: null });
  });

  it('prend le dernier mot comme un début de mot', async () => {
    const results = await search('proc');

    expect(results.courses.items.map((course) => course.title)).toEqual([
      'Les processus',
      'La mémoire virtuelle',
    ]);
  });

  it('exige tous les mots', async () => {
    expect((await search('pagination processus')).courses.total).toBe(1);
    expect((await search('pagination ordonnanceur')).courses.total).toBe(0);
  });

  it('cherche dans le libellé et la forme développée des acronymes', async () => {
    expect((await search('mmu')).acronyms.items[0].label).toBe('MMU');
    expect((await search('management')).acronyms.items[0]).toMatchObject({
      label: 'MMU',
      expandedForm: 'Memory Management Unit',
    });
  });

  it('renvoie l’extrait comme du texte, jamais comme du HTML', async () => {
    const [course] = (await search('pagination fixes')).courses.items;

    expect(highlighted(course.excerpt)).toEqual(['pagination', 'fixes']);
    for (const segment of course.excerpt) {
      expect(Object.keys(segment)).toEqual(['text', 'highlighted']);
      expect(segment.text).not.toContain(HIGHLIGHT_START);
      expect(segment.text).not.toContain(HIGHLIGHT_STOP);
    }
  });

  it('suit les modifications d’un cours', async () => {
    await client('patch', `/api/courses/${memoryCourseId}`).send({
      title: 'La segmentation',
    });

    expect((await search('segmentation')).courses.total).toBe(1);
    expect((await search('virtuelle')).courses.total).toBe(0);
  });

  it('ne plante pas sur une saisie faite de signes ou de mots vides', async () => {
    const empty = { total: 0, items: [] };

    expect((await search('&| !:*')).courses).toEqual(empty);
    expect((await search('le la')).courses).toEqual(empty);
    expect((await search("'; DROP TABLE courses; --")).courses).toEqual(empty);
  });

  it.each([
    ['absente', {}],
    ['trop courte', { q: ' a ' }],
    ['trop longue', { q: 'a'.repeat(101) }],
    ['accompagnée d’un paramètre inconnu', { q: 'memoire', tri: 'date' }],
  ])('refuse une recherche %s', async (_label, query) => {
    const response = await client('get', '/api/search').query(query);

    expect(response.status).toBe(400);
  });
});
