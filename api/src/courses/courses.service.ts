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
import { collectFigures } from './content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from './content/content-node.js';
import { extractPlainText } from './content/extract-plain-text.js';
import { ContentRules, validateContent } from './content/validate-content.js';
import { Course } from './course.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CourseImagesService } from './images/course-images.service.js';

const UNIQUE_VIOLATION = '23505';

// Résumé d'un cours pour les listes ; les sections sont ses titres de premier niveau.
export type CourseSummary = Pick<
  Course,
  'id' | 'title' | 'position' | 'updatedAt'
> & { sectionCount: number; hasBookmark: boolean };

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ueService: UeService,
    private readonly imagesService: CourseImagesService,
    private readonly courseFolders: CourseFoldersService,
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
      await this.dataSource.transaction((manager) =>
        this.saveWithFolder(manager, course),
      );
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
    // Les images du cours servent à son texte, à sa fiche de révision et à ses exercices.
    const figures = [
      ...collectFigures(course.content),
      ...(course.sheetContent ? collectFigures(course.sheetContent) : []),
      ...(course.exercisesContent
        ? collectFigures(course.exercisesContent)
        : []),
    ];
    await this.imagesService.assertFiguresExist(id, figures);
    // Le cours et ses images changent ensemble ou pas du tout.
    const unused = await this.dataSource.transaction(async (manager) => {
      await this.saveWithFolder(manager, course);
      return this.imagesService.reconcile(manager, id, figures);
    });
    await this.imagesService.removeFiles(unused);
    return this.findById(id);
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

function checkContent(content: unknown, rules: ContentRules = {}): ContentNode {
  const errors = validateContent(content, rules);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return content as ContentNode;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
  );
}
