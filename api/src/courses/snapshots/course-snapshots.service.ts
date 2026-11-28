import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { collectFigures } from '../content/collect-figures.js';
import { ContentNode } from '../content/content-node.js';
import { Course } from '../course.entity.js';
import { CourseSnapshot, SnapshotOrigin } from './course-snapshot.entity.js';

// Nombre d'instantanés gardés par cours pour chaque origine ; les plus anciens sont
// supprimés. Une série de corrections de l'IA n'efface donc jamais l'état d'avant un
// remplacement par un paquet ou une restauration.
export const MAX_SNAPSHOTS: Record<SnapshotOrigin, number> = {
  ai: 30,
  package: 10,
  restore: 10,
};

export type SnapshotSummary = Pick<
  CourseSnapshot,
  'id' | 'origin' | 'revision' | 'title' | 'createdAt'
>;

// Les trois documents d'un cours ou d'un instantané.
type Documents = Pick<Course, 'content' | 'sheetContent' | 'exercisesContent'>;

export function documentsOf(holder: Documents): ContentNode[] {
  return [holder.content, holder.sheetContent, holder.exercisesContent].filter(
    (document) => document !== null,
  );
}

@Injectable()
export class CourseSnapshotsService {
  constructor(
    @InjectRepository(CourseSnapshot)
    private readonly snapshots: Repository<CourseSnapshot>,
  ) {}

  // Du plus récent au plus ancien, sans les documents.
  list(courseId: number): Promise<SnapshotSummary[]> {
    return this.snapshots.find({
      select: {
        id: true,
        origin: true,
        revision: true,
        title: true,
        createdAt: true,
      },
      where: { courseId },
      order: { id: 'DESC' },
    });
  }

  async findOne(courseId: number, id: number): Promise<CourseSnapshot> {
    const snapshot = await this.snapshots.findOneBy({ id, courseId });
    if (!snapshot) {
      throw new NotFoundException('Cette version du cours n’existe pas.');
    }
    return snapshot;
  }

  // Garde l'état du cours tel qu'il est donné, à prendre avant de le modifier, puis ne
  // conserve que les plus récents de cette origine. À appeler dans la transaction de l'écriture.
  async take(
    manager: EntityManager,
    course: Course,
    origin: SnapshotOrigin,
  ): Promise<void> {
    await manager.save(
      manager.create(CourseSnapshot, {
        courseId: course.id,
        origin,
        revision: course.revision,
        title: course.title,
        content: course.content,
        sheetContent: course.sheetContent,
        exercisesContent: course.exercisesContent,
      }),
    );
    await manager.query(
      `DELETE FROM course_snapshots
        WHERE course_id = $1
          AND origin = $2
          AND id NOT IN (SELECT id FROM course_snapshots
                          WHERE course_id = $1 AND origin = $2
                          ORDER BY id DESC
                          LIMIT $3)`,
      [course.id, origin, MAX_SNAPSHOTS[origin]],
    );
  }

  // Images encore utilisées par un instantané du cours : elles ne doivent pas être
  // effacées, sans quoi une restauration afficherait des images manquantes.
  async referencedImageIds(
    manager: EntityManager,
    courseId: number,
  ): Promise<number[]> {
    const snapshots = await manager.findBy(CourseSnapshot, { courseId });
    const ids = snapshots
      .flatMap(documentsOf)
      .flatMap(collectFigures)
      .map((figure) => figure.imageId);
    return [...new Set(ids)];
  }
}
