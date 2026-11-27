import { Test } from 'supertest';
import { Course } from '../src/courses/course.entity.js';
import { AuthenticatedClient } from './authenticated-client.js';

// Enregistre un cours comme le fait l'éditeur : en indiquant la révision qu'il vient de lire.
export async function saveCourse(
  client: AuthenticatedClient,
  id: number,
  changes: object,
): Promise<Awaited<Test>> {
  const read = await client('get', `/api/courses/${id}`);
  const { revision } = read.body as Course;
  return client('patch', `/api/courses/${id}`).send({ ...changes, revision });
}
