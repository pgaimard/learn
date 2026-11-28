import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  CourseFolderSummary,
  CourseFoldersService,
} from '../files/folders/course-folders.service.js';
import { UeService } from '../ue/ue.service.js';
import { collectFigures, FigureReference } from './content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from './content/content-node.js';
import { extractPlainText } from './content/extract-plain-text.js';
import { ensureHeadingIds } from './content/heading-ids.js';
import { ContentRules, validateContent } from './content/validate-content.js';
import { Course } from './course.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CourseImage } from './images/course-image.entity.js';
import { CourseImagesService } from './images/course-images.service.js';
import {
  CourseSnapshotsService,
  documentsOf,
} from './snapshots/course-snapshots.service.js';

const UNIQUE_VIOLATION = '23505';
// Durée pendant laquelle un cours reste « en édition » sans nouvelles de l'éditeur.
const EDITING_SECONDS = 120;

// Résumé d'un cours pour les listes ; les sections sont ses titres de premier niveau.
export type CourseSummary = Pick<
  Course,
  'id' | 'title' | 'position' | 'updatedAt'
> & { sectionCount: number; hasBookmark: boolean };

// Les trois documents d'un cours.
export type CourseDocumentField =
  'content' | 'sheetContent' | 'exercisesContent';

const MISSING_DOCUMENT: Record<CourseDocumentField, string> = {
  content: 'Ce cours n’a pas de contenu.',
  sheetContent: 'Ce cours n’a pas de fiche de révision.',
  exercisesContent: 'Ce cours n’a pas d’exercices.',
};

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ueService: UeService,
    private readonly imagesService: CourseImagesService,
    private readonly courseFolders: CourseFoldersService,
    private readonly snapshots: CourseSnapshotsService,
  ) {}

  async findAllByUe(ueCode: string): Promise<CourseSummary[]> {
    const ue = await this.ueService.findByCode(ueCode);
    return this.courses.query<CourseSummary[]>(
      `SELECT c.id, c.title, c.position, c.updated_at AS "updatedAt",
              (SELECT count(*)::int
                 FROM jsonb_array_elements(c.content -> 'content') AS block
                WHERE block ->> 'type' = 'heading'
                  AND block -> 'attrs' ->> 'level' = '2') AS "sectionCount",
              c.bookmark_block IS NOT NULL AS "hasBookmark"
         FROM courses c
        WHERE c.ue_id = $1
        ORDER BY c.position`,
      [ue.id],
    );
  }

  async findById(id: number): Promise<Course> {
    const course = await this.courses.findOne({
      where: { id },
      relations: { ue: true },
    });
    if (!course) {
      throw new NotFoundException('Ce cours n’existe pas.');
    }
    return course;
  }

  async create(ueCode: string, input: CreateCourseDto): Promise<Course> {
    const ue = await this.ueService.findByCode(ueCode);
    const content = checkContent(input.content ?? EMPTY_CONTENT);
    if (collectFigures(content).length > 0) {
      throw new BadRequestException(
        'Les images s’ajoutent une fois le cours créé.',
      );
    }
    const course = this.courses.create({
      ueId: ue.id,
      title: input.title,
      // Un nouveau cours se place à la suite ; l'ordre se change ensuite par reorder.
      position: await this.nextPosition(ue.id),
      content,
      plainText: extractPlainText(content),
    });
    // Le cours et son dossier de fichiers naissent ensemble.
    const saved = await this.dataSource.transaction(async (manager) => {
      const created = await this.save(manager, course);
      await this.courseFolders.attach(manager, created);
      return created;
    });
    return this.findById(saved.id);
  }

  async update(id: number, changes: UpdateCourseDto): Promise<Course> {
    const course = await this.findById(id);
    course.title = changes.title ?? course.title;
    if (
      changes.content === undefined &&
      changes.sheetContent === undefined &&
      changes.exercisesContent === undefined
    ) {
      await this.dataSource.transaction(async (manager) => {
        await this.claimRevision(manager, course, changes.revision);
        await this.saveWithFolder(manager, course);
      });
      return this.findById(id);
    }
    if (changes.content !== undefined) {
      course.content = checkContent(changes.content);
      course.plainText = extractPlainText(course.content);
    }
    if (changes.sheetContent !== undefined) {
      course.sheetContent =
        changes.sheetContent === null
          ? null
          : checkContent(changes.sheetContent);
    }
    if (changes.exercisesContent !== undefined) {
      course.exercisesContent =
        changes.exercisesContent === null
          ? null
          : checkContent(changes.exercisesContent, { exercises: true });
    }
    const figures = await this.checkFigures(course);
    // Le cours et ses images changent ensemble ou pas du tout.
    const unused = await this.dataSource.transaction(async (manager) => {
      await this.claimRevision(manager, course, changes.revision);
      await this.saveWithFolder(manager, course);
      return this.reconcileImages(manager, id, figures);
    });
    await this.imagesService.removeFiles(unused);
    return this.findById(id);
  }

  // Remet le cours dans l'état d'un de ses instantanés. L'état actuel est d'abord gardé :
  // une restauration se défait comme toute autre écriture.
  async restoreSnapshot(
    id: number,
    snapshotId: number,
    readRevision: number,
  ): Promise<Course> {
    const course = await this.findById(id);
    const snapshot = await this.snapshots.findOne(id, snapshotId);
    // L'instantané a pu être pris sous d'anciennes règles : il repasse par la liste blanche.
    const content = checkContent(snapshot.content);
    const sheetContent =
      snapshot.sheetContent && checkContent(snapshot.sheetContent);
    const exercisesContent =
      snapshot.exercisesContent &&
      checkContent(snapshot.exercisesContent, { exercises: true });
    const figures = await this.checkFigures({
      id,
      content,
      sheetContent,
      exercisesContent,
    });
    const unused = await this.dataSource.transaction(async (manager) => {
      await this.assertNotEditing(manager, id);
      await this.snapshots.take(manager, course, 'restore');
      await this.claimRevision(manager, course, readRevision);
      course.title = snapshot.title;
      course.content = content;
      course.plainText = extractPlainText(content);
      course.sheetContent = sheetContent;
      course.exercisesContent = exercisesContent;
      await this.saveWithFolder(manager, course);
      return this.reconcileImages(manager, id, figures);
    });
    await this.imagesService.removeFiles(unused);
    return this.findById(id);
  }

  // Écriture de l'IA sur un document du cours. Elle est refusée si le cours a changé
  // depuis sa lecture, s'il est ouvert dans l'éditeur, ou si elle ferait perdre des
  // tentatives ; l'état d'avant est gardé dans un instantané.
  async writeDocument(
    id: number,
    name: CourseDocumentField,
    readRevision: number,
    edit: (document: ContentNode) => ContentNode,
  ): Promise<Course> {
    const course = await this.findById(id);
    const current = course[name];
    if (current === null) {
      throw new NotFoundException(MISSING_DOCUMENT[name]);
    }
    const next = checkContent(
      edit(current),
      name === 'exercisesContent' ? { exercises: true } : {},
    );
    const figures = await this.checkFigures({ ...course, [name]: next });
    const unused = await this.dataSource.transaction(async (manager) => {
      await this.assertNotEditing(manager, id);
      if (name === 'exercisesContent') {
        await this.assertAttemptsKept(manager, id, current, next);
      }
      await this.snapshots.take(manager, course, 'ai');
      await this.claimRevision(manager, course, readRevision);
      course[name] = next;
      if (name === 'content') {
        course.plainText = extractPlainText(next);
      }
      await this.saveWithFolder(manager, course);
      return this.reconcileImages(manager, id, figures);
    });
    await this.imagesService.removeFiles(unused);
    return this.findById(id);
  }

  // Les tentatives tiennent à la clé d'un exercice, ou au rang d'un QCM parmi ceux du
  // document : une écriture ne doit faire disparaître ni l'un ni l'autre.
  private async assertAttemptsKept(
    manager: EntityManager,
    id: number,
    before: ContentNode,
    after: ContentNode,
  ): Promise<void> {
    const rows = await manager.query<{ key: string }[]>(
      'SELECT DISTINCT exercise_key AS key FROM exercise_attempts WHERE course_id = $1',
      [id],
    );
    const [was, kept] = [attemptKeysOf(before), attemptKeysOf(after)];
    // Une clé garde ses tentatives si elle désigne encore le même exercice ou QCM.
    const lost = rows
      .map((row) => row.key)
      .filter((key) => was.has(key) && kept.get(key) !== was.get(key));
    if (lost.length > 0) {
      throw new ConflictException(
        `Cette écriture ferait perdre des réponses déjà enregistrées (${lost.join(', ')}) : un exercice garde son titre, et les QCM gardent leur nombre et leur ordre. Renommez ou retirez-les dans l’éditeur.`,
      );
    }
  }

  // Pose le marque-page de lecture, ou le retire (null). Ce n'est pas une modification
  // du cours : sa date de modification ne bouge pas.
  async setBookmark(
    id: number,
    bookmark: { title: string; block: number } | null,
  ): Promise<Course> {
    await this.findById(id);
    await this.courses.query(
      'UPDATE courses SET bookmark_title = $2, bookmark_block = $3 WHERE id = $1',
      [id, bookmark?.title ?? null, bookmark?.block ?? null],
    );
    return this.findById(id);
  }

  // L'éditeur déclare le cours « en édition » et le redit tant qu'il reste ouvert. Sans
  // nouvelles de lui pendant ce délai (onglet fermé, poste en veille), le cours est libre.
  async startEditing(id: number): Promise<void> {
    await this.findById(id);
    await this.courses.query(
      `UPDATE courses SET editing_until = now() + make_interval(secs => $2)
        WHERE id = $1`,
      [id, EDITING_SECONDS],
    );
  }

  async stopEditing(id: number): Promise<void> {
    await this.findById(id);
    await this.courses.query(
      'UPDATE courses SET editing_until = NULL WHERE id = $1',
      [id],
    );
  }

  // Refuse une écriture qui ne vient pas de l'éditeur tant que le cours y est ouvert :
  // l'éditeur enregistre le document entier et écraserait ce qu'elle aurait changé.
  async assertNotEditing(manager: EntityManager, id: number): Promise<void> {
    const editing = await manager.query<unknown[]>(
      'SELECT 1 FROM courses WHERE id = $1 AND editing_until > now()',
      [id],
    );
    if (editing.length > 0) {
      throw new ConflictException(
        'Ce cours est ouvert dans l’éditeur. Fermez-le avant de le modifier autrement.',
      );
    }
  }

  // Réordonne tous les cours d'une UE : la liste doit les contenir tous, une fois chacun.
  async reorder(ueCode: string, ids: number[]): Promise<CourseSummary[]> {
    const ue = await this.ueService.findByCode(ueCode);
    const existing = await this.courses.find({
      select: { id: true },
      where: { ueId: ue.id },
    });
    const known = new Set(existing.map((course) => course.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      throw new BadRequestException(
        'L’ordre doit contenir tous les cours de l’UE, une fois chacun.',
      );
    }
    await this.dataSource.transaction((manager) =>
      this.renumber(manager, ue.id, ids),
    );
    return this.findAllByUe(ueCode);
  }

  // Donne aux cours les rangs 1 à n dans l'ordre de la liste. Deux cours d'une UE ne
  // peuvent pas partager un rang, même un instant : ils passent d'abord par des rangs
  // négatifs, qui ne croisent ni les anciens ni les nouveaux.
  async renumber(
    manager: EntityManager,
    ueId: number,
    ids: number[],
  ): Promise<void> {
    await manager.query('UPDATE courses SET position = -id WHERE ue_id = $1', [
      ueId,
    ]);
    for (const [index, id] of ids.entries()) {
      await manager.update(Course, { id, ueId }, { position: index + 1 });
    }
  }

  findFolder(id: number): Promise<CourseFolderSummary | null> {
    return this.findById(id).then(() => this.courseFolders.describe(id));
  }

  // Supprime le cours. Son dossier de fichiers part avec lui s'il est vide ou si
  // deleteFolder le demande ; sinon il reste dans l'UE, comme dossier libre.
  async remove(id: number, deleteFolder = false): Promise<void> {
    const course = await this.findById(id);
    const images = await this.imagesService.findByCourse(id);
    const folder = await this.courseFolders.describe(id);
    const isEmpty = folder?.fileCount === 0 && folder.folderCount === 0;
    const storedFiles = await this.dataSource.transaction(async (manager) => {
      const removed =
        deleteFolder || isEmpty
          ? await this.courseFolders.removeTree(manager, id)
          : [];
      await manager.remove(course);
      return removed;
    });
    await this.imagesService.removeFiles(images);
    await this.courseFolders.removeStored(storedFiles);
  }

  // Images des trois documents du cours : elles servent à son texte, à sa fiche de révision
  // et à ses exercices. Refuse une image inconnue ou d'un autre cours.
  private async checkFigures(
    course: Pick<
      Course,
      'id' | 'content' | 'sheetContent' | 'exercisesContent'
    >,
  ): Promise<FigureReference[]> {
    const figures = documentsOf(course).flatMap(collectFigures);
    await this.imagesService.assertFiguresExist(course.id, figures);
    return figures;
  }

  // Supprime les images que ni le cours ni un de ses instantanés n'utilisent plus.
  private async reconcileImages(
    manager: EntityManager,
    id: number,
    figures: FigureReference[],
  ): Promise<CourseImage[]> {
    const kept = await this.snapshots.referencedImageIds(manager, id);
    return this.imagesService.reconcile(manager, id, figures, kept);
  }

  // Passe le cours à la révision suivante, à condition qu'il soit encore à celle que
  // l'appelant a lue. Le test et l'incrément ne font qu'une requête : de deux
  // enregistrements simultanés partis de la même révision, un seul passe.
  private async claimRevision(
    manager: EntityManager,
    course: Course,
    readRevision: number,
  ): Promise<void> {
    // Le cours donné doit être celui que l'appelant a lu : c'est son état qui est modifié,
    // et gardé dans un instantané.
    const rows =
      course.revision === readRevision
        ? await this.bumpRevision(manager, course.id, readRevision)
        : [];
    if (rows.length === 0) {
      throw new ConflictException(
        'Ce cours a été modifié depuis son ouverture. Rechargez la page pour repartir de sa version actuelle.',
      );
    }
    course.revision = rows[0].revision;
  }

  private async bumpRevision(
    manager: EntityManager,
    id: number,
    readRevision: number,
  ): Promise<{ revision: number }[]> {
    const [rows] = await manager.query<[{ revision: number }[], number]>(
      `UPDATE courses SET revision = revision + 1
        WHERE id = $1 AND revision = $2
        RETURNING revision`,
      [id, readRevision],
    );
    return rows;
  }

  private async nextPosition(ueId: number): Promise<number> {
    const last = await this.courses.maximum('position', { ueId });
    return (last ?? 0) + 1;
  }

  // Enregistre le cours ; le nom de son dossier suit son titre.
  private async saveWithFolder(
    manager: EntityManager,
    course: Course,
  ): Promise<void> {
    await this.save(manager, course);
    await this.courseFolders.rename(manager, course);
  }

  private async save(manager: EntityManager, course: Course): Promise<Course> {
    try {
      return await manager.save(course);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Un cours occupe déjà l’ordre ${course.position} dans cette UE.`,
        );
      }
      throw error;
    }
  }
}

// Clés sous lesquelles des tentatives sont enregistrées pour ces exercices, avec le titre
// de ce qu'elles désignent : la clé de chaque exercice, et « qcm-<rang> » pour chaque QCM
// (voir course-read-page.ts).
function attemptKeysOf(exercises: ContentNode): Map<string, string> {
  const blocks = exercises.content ?? [];
  const titleOf = (block: ContentNode): string =>
    String(block.attrs?.['title']);
  const quizzes = blocks.filter((block) => block.type === 'quiz');
  return new Map([
    ...blocks
      .filter((block) => block.type === 'exercise')
      .map((block): [string, string] => [String(block.attrs?.['key']), '']),
    ...quizzes.map((quiz, index): [string, string] => [
      `qcm-${index + 1}`,
      titleOf(quiz),
    ]),
  ]);
}

function checkContent(content: unknown, rules: ContentRules = {}): ContentNode {
  const errors = validateContent(content, rules);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return ensureHeadingIds(content as ContentNode);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
  );
}
