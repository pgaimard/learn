import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Ue } from '../../ue/ue.entity.js';
import {
  CourseFoldersService,
  StoredSources,
} from '../../files/folders/course-folders.service.js';
import { UeService } from '../../ue/ue.service.js';
import {
  buildImageSource,
  collectFigures,
} from '../content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from '../content/content-node.js';
import { extractPlainText } from '../content/extract-plain-text.js';
import { EXERCISE_ONLY_TYPES } from '../content/content-schema.js';
import { ContentRules, validateContent } from '../content/validate-content.js';
import { Course } from '../course.entity.js';
import { CoursesService } from '../courses.service.js';
import { CourseImage } from '../images/course-image.entity.js';
import {
  CourseImagesService,
  prepareImage,
} from '../images/course-images.service.js';
import { markdownToContent } from './markdown-to-content.js';
import { TermImage } from '../../terms/images/term-image.entity.js';
import { TermImagesService } from '../../terms/images/term-images.service.js';
import {
  CommandImportPreview,
  importCommands,
  previewCommands,
} from '../../tools/import/command-import.js';
import {
  parseCommands,
  ParsedTool,
} from '../../tools/import/parse-commands.js';
import { CourseMetadata, parseFrontMatter } from './parse-front-matter.js';
import { ParsedTerm, parseTerms } from './parse-terms.js';
import { findAltText, placeImages } from './place-images.js';
import { PackageFiles } from './read-package.js';
import {
  insertTerms,
  replaceTerms,
  sortTerms,
  TermImageWriter,
  TermReference,
  toReference,
} from './term-import.js';

export interface ImportPreview {
  ueCode: string;
  title: string;
  position: number;
  sectionCount: number;
  imageCount: number;
  termCount: number;
  // Images des définitions que l'import créera.
  termImageCount: number;
  // Termes de termes.json que l'import créera, et ceux déjà présents : il les laisse tels
  // quels, ou remplace leur définition si on le lui demande.
  newTerms: TermReference[];
  duplicateTerms: TermReference[];
  // Le paquet contient une fiche de révision (fiche.md), et le nombre de ses images.
  hasSheet: boolean;
  sheetImageCount: number;
  // Le paquet contient les exercices du chapitre (exercices.md).
  hasExercises: boolean;
  // Documents de sources/, que l'import range dans le dossier de fichiers du cours.
  sourceCount: number;
  // Outils et commandes de commandes.json : ceux que l'import créera, ceux déjà présents.
  commands: CommandImportPreview;
  // Chapitre de même titre déjà présent dans l'UE : l'import le remplacerait. Sa fiche
  // de révision, s'il en a une, est gardée quand le paquet n'en apporte pas.
  existingCourse: {
    id: number;
    title: string;
    hasSheet: boolean;
    hasExercises: boolean;
  } | null;
}

// Images d'un import : celles écrites sur disque, à effacer s'il échoue, ou celles
// qu'il remplace, à effacer s'il réussit.
interface PackageImages {
  course: CourseImage[];
  term: TermImage[];
}

interface AnalysedPackage {
  metadata: CourseMetadata;
  document: ContentNode;
  images: Map<string, Buffer>;
  // Fiche de révision de fiche.md et ses images ; null quand le paquet n'en a pas.
  sheet: { document: ContentNode; images: Map<string, Buffer> } | null;
  // Exercices de exercices.md et leurs images ; null quand le paquet n'en a pas.
  exercises: { document: ContentNode; images: Map<string, Buffer> } | null;
  // Images référencées par les définitions de termes.json.
  termImages: Map<string, Buffer>;
  sectionCount: number;
  terms: ParsedTerm[];
  // Outils de commandes.json, avec leurs commandes.
  tools: ParsedTool[];
}

@Injectable()
export class CourseImportService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ueService: UeService,
    private readonly imagesService: CourseImagesService,
    private readonly coursesService: CoursesService,
    private readonly termImagesService: TermImagesService,
    private readonly courseFolders: CourseFoldersService,
  ) {}

  async preview(files: PackageFiles): Promise<ImportPreview> {
    const analysed = analyse(files);
    const ue = await this.findUe(analysed.metadata.ueCode);
    const existing = await this.findExisting(ue, analysed.metadata.title);
    const terms = await sortTerms(
      this.dataSource.manager,
      analysed.terms,
      ue.id,
    );
    return {
      ...analysed.metadata,
      sectionCount: analysed.sectionCount,
      imageCount: analysed.images.size,
      termCount: analysed.terms.length,
      termImageCount: terms.fresh.reduce(
        (count, term) => count + term.imagePaths.length,
        0,
      ),
      newTerms: terms.fresh.map(toReference),
      duplicateTerms: terms.duplicates.map(toReference),
      commands: await previewCommands(this.dataSource.manager, analysed.tools),
      hasSheet: analysed.sheet !== null,
      sheetImageCount: analysed.sheet?.images.size ?? 0,
      hasExercises: analysed.exercises !== null,
      sourceCount: files.sources.size,
      existingCourse: existing
        ? {
            id: existing.id,
            title: existing.title,
            hasSheet: existing.sheetContent !== null,
            hasExercises: existing.exercisesContent !== null,
          }
        : null,
    };
  }

  // replace : remplacer le chapitre de même titre ; replaceTerms et replaceCommands :
  // remplacer aussi la définition des termes et les commandes déjà présents, au lieu de
  // les laisser tels quels.
  async import(
    files: PackageFiles,
    replace: boolean,
    replaceTerms = false,
    replaceCommands = false,
  ): Promise<Course> {
    const analysed = analyse(files);
    const ue = await this.findUe(analysed.metadata.ueCode);
    const existing = await this.findExisting(ue, analysed.metadata.title);
    if (existing && !replace) {
      throw new ConflictException(
        `Le chapitre « ${existing.title} » existe déjà dans ${ue.code} : confirmez son remplacement.`,
      );
    }
    const written: PackageImages = { course: [], term: [] };
    const sources: StoredSources = { written: [], replaced: [] };
    try {
      // Cours, images, contenu, termes et commandes sont enregistrés ensemble ou pas du tout.
      const { courseId, obsolete } = await this.dataSource.transaction(
        async (manager) => {
          const result = await this.write(
            manager,
            ue,
            existing,
            analysed,
            written,
            { terms: replaceTerms, commands: replaceCommands },
          );
          // Les documents sources rejoignent le dossier de fichiers du cours.
          await this.courseFolders.storeSources(
            manager,
            {
              id: result.courseId,
              ueId: ue.id,
              title: analysed.metadata.title,
            },
            files.sources,
            sources,
          );
          return result;
        },
      );
      await this.courseFolders.removeStored(sources.replaced);
      await this.imagesService.removeFiles(obsolete.course);
      await this.termImagesService.removeFiles(obsolete.term);
      return await this.courses.findOneOrFail({
        where: { id: courseId },
        relations: { ue: true },
      });
    } catch (error) {
      await this.imagesService.removeFiles(written.course);
      await this.termImagesService.removeFiles(written.term);
      await this.courseFolders.removeStored(sources.written);
      throw error;
    }
  }

  private async write(
    manager: EntityManager,
    ue: Ue,
    existing: Course | null,
    analysed: AnalysedPackage,
    written: PackageImages,
    // Ce qui, déjà présent, est remplacé par le paquet.
    replaced: { terms: boolean; commands: boolean },
  ): Promise<{ courseId: number; obsolete: PackageImages }> {
    const { metadata } = analysed;
    const course = existing ?? (await this.insertAtRank(manager, ue, metadata));
    // Remplacer un chapitre le modifie : un éditeur resté ouvert sur l'ancienne version
    // ne pourra pas l'écraser.
    if (existing) {
      course.revision += 1;
    }
    // Un paquet sans fiche laisse en place celle du chapitre, avec ses images.
    const keptSheet = analysed.sheet ? null : course.sheetContent;
    // De même pour ses exercices.
    const keptExercises = analysed.exercises ? null : course.exercisesContent;
    const keptIds = [
      ...collectFigures(keptSheet ?? EMPTY_CONTENT),
      ...collectFigures(keptExercises ?? EMPTY_CONTENT),
    ].map((figure) => figure.imageId);
    const obsolete = (
      await manager.findBy(CourseImage, { courseId: course.id })
    ).filter((image) => !keptIds.includes(image.id));
    if (obsolete.length > 0) {
      await manager.delete(CourseImage, {
        id: In(obsolete.map((image) => image.id)),
      });
    }
    // Enregistre les images d'un document du paquet et les y met à leur adresse.
    const store = async (
      document: ContentNode,
      images: Map<string, Buffer>,
      rules: ContentRules = {},
    ): Promise<ContentNode> => {
      const sources = new Map<string, string>();
      for (const [path, data] of images) {
        const image = await this.imagesService.upload(
          course.id,
          data,
          findAltText(document, path),
          manager,
        );
        written.course.push(image);
        sources.set(path, buildImageSource('courses', course.id, image.id));
      }
      const content = placeImages(document, sources);
      throwIfAny(validateContent(content, rules));
      return content;
    };
    const content = await store(analysed.document, analysed.images);
    course.title = metadata.title;
    course.content = content;
    course.plainText = extractPlainText(content);
    course.sheetContent = analysed.sheet
      ? await store(analysed.sheet.document, analysed.sheet.images)
      : keptSheet;
    course.exercisesContent = analysed.exercises
      ? await store(analysed.exercises.document, analysed.exercises.images, {
          exercises: true,
        })
      : keptExercises;
    await manager.save(course);
    await this.courseFolders.rename(manager, course);
    const terms = await sortTerms(manager, analysed.terms, ue.id);
    const origin = { ueId: ue.id, courseId: course.id };
    const termImages: TermImageWriter = {
      files: analysed.termImages,
      upload: async (termId, data, altText) => {
        const image = await this.termImagesService.upload(
          termId,
          data,
          altText,
          manager,
        );
        written.term.push(image);
        return image.id;
      },
    };
    await insertTerms(manager, terms.fresh, origin, termImages);
    const obsoleteTermImages = replaced.terms
      ? await replaceTerms(manager, terms.duplicates, origin, termImages)
      : [];
    await importCommands(manager, analysed.tools, {
      replace: replaced.commands,
      courseId: course.id,
    });
    return {
      courseId: course.id,
      obsolete: { course: obsolete, term: obsoleteTermImages },
    };
  }

  // Crée le chapitre et le place au rang demandé par « ordre » parmi ceux de l'UE
  // (à la fin si le rang dépasse leur nombre) ; les suivants reculent d'un rang.
  private async insertAtRank(
    manager: EntityManager,
    ue: Ue,
    metadata: CourseMetadata,
  ): Promise<Course> {
    const siblings = await manager.find(Course, {
      select: { id: true, position: true },
      where: { ueId: ue.id },
      order: { position: 'ASC' },
    });
    const course = await manager.save(
      manager.create(Course, {
        ueId: ue.id,
        title: metadata.title,
        // Rang provisoire, après tous les autres : il ne croise aucun rang existant.
        position: (siblings.at(-1)?.position ?? 0) + 1,
        content: EMPTY_CONTENT,
        plainText: '',
      }),
    );
    const ids = siblings.map((sibling) => sibling.id);
    const rank = Math.min(Math.max(metadata.position, 1), ids.length + 1);
    ids.splice(rank - 1, 0, course.id);
    await this.coursesService.renumber(manager, ue.id, ids);
    // L'objet en mémoire suit : il est enregistré de nouveau avec le contenu.
    course.position = rank;
    return course;
  }

  private async findUe(code: string): Promise<Ue> {
    try {
      return await this.ueService.findByCode(code);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `L’UE ${code} n’existe pas : créez-la d’abord.`,
        );
      }
      throw error;
    }
  }

  // Un chapitre est reconnu par son titre dans l'UE, sans tenir compte de la casse :
  // son rang est libre, il se change en faisant glisser les cours dans la liste.
  private findExisting(ue: Ue, title: string): Promise<Course | null> {
    return this.courses
      .createQueryBuilder('course')
      .where('course.ue_id = :ueId', { ueId: ue.id })
      .andWhere('lower(course.title) = lower(:title)', { title })
      .orderBy('course.position', 'ASC')
      .getOne();
  }
}

function throwIfAny(errors: string[]): void {
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
}

// Vérifie tout le paquet avant la moindre écriture et rassemble les erreurs.
function analyse(files: PackageFiles): AnalysedPackage {
  const header = parseFrontMatter(files.markdown);
  const converted = markdownToContent(header.body, header.lineOffset);
  const errors = [...header.errors, ...converted.errors];
  const checked = new Set<string>();
  // Relève l'image d'un chemin du paquet ; chaque fichier n'est vérifié qu'une fois.
  const collect = (
    path: string,
    referrer: string,
    target: Map<string, Buffer>,
  ): void => {
    const data = files.images.get(path);
    if (!data) {
      errors.push(`${referrer} référence « ${path} », absent du paquet.`);
      return;
    }
    target.set(path, data);
    if (!checked.has(path)) {
      checked.add(path);
      errors.push(...checkImage(path, data));
    }
  };
  const images = new Map<string, Buffer>();
  for (const path of converted.imagePaths) {
    collect(path, 'cours.md', images);
  }
  let sheet: AnalysedPackage['sheet'] = null;
  if (files.sheet !== null) {
    const fiche = markdownToContent(files.sheet, 0, 'fiche.md');
    errors.push(...fiche.errors);
    const isBlank =
      extractPlainText(fiche.document).trim() === '' &&
      fiche.imagePaths.length === 0;
    if (fiche.errors.length === 0 && isBlank) {
      errors.push('fiche.md est vide.');
    }
    sheet = { document: fiche.document, images: new Map() };
    for (const path of fiche.imagePaths) {
      collect(path, 'fiche.md', sheet.images);
    }
  }
  errors.push(...misplacedExercises(converted.document, 'cours.md'));
  if (sheet) {
    errors.push(...misplacedExercises(sheet.document, 'fiche.md'));
  }
  let exercises: AnalysedPackage['exercises'] = null;
  if (files.exercises !== null) {
    const parsed = markdownToContent(files.exercises, 0, 'exercices.md');
    errors.push(...parsed.errors);
    const isBlank =
      extractPlainText(parsed.document).trim() === '' &&
      parsed.imagePaths.length === 0;
    if (parsed.errors.length === 0 && isBlank) {
      errors.push('exercices.md est vide.');
    }
    exercises = { document: parsed.document, images: new Map() };
    for (const path of parsed.imagePaths) {
      collect(path, 'exercices.md', exercises.images);
    }
  }
  const terms = parseTerms(files.terms);
  errors.push(...terms.errors);
  const termImages = new Map<string, Buffer>();
  for (const term of terms.terms) {
    for (const path of term.imagePaths) {
      collect(path, `termes.json, « ${term.label} »`, termImages);
    }
  }
  const commands = parseCommands(files.commands);
  errors.push(...commands.errors);
  if (!header.metadata || errors.length > 0) {
    throw new BadRequestException(errors.slice(0, 10));
  }
  return {
    metadata: header.metadata,
    document: converted.document,
    images,
    sheet,
    exercises,
    termImages,
    sectionCount: converted.sectionCount,
    terms: terms.terms,
    tools: commands.tools,
  };
}

// Un QCM ou un exercice écrit ailleurs que dans exercices.md fait refuser le paquet.
function misplacedExercises(document: ContentNode, source: string): string[] {
  const isMisplaced = (document.content ?? []).some((block) =>
    EXERCISE_ONLY_TYPES.includes(block.type),
  );
  return isMisplaced
    ? [
        `${source} : un QCM ou un exercice se place dans exercices.md, pas dans ${source}.`,
      ]
    : [];
}

function checkImage(path: string, data: Buffer): string[] {
  try {
    prepareImage(data);
    return [];
  } catch (error) {
    const reason =
      error instanceof HttpException ? error.message : 'fichier illisible.';
    return [`${path} : ${reason}`];
  }
}
