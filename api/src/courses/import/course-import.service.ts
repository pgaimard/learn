import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Ue } from '../../ue/ue.entity.js';
import { UeService } from '../../ue/ue.service.js';
import { buildImageSource } from '../content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from '../content/content-node.js';
import { extractPlainText } from '../content/extract-plain-text.js';
import { validateContent } from '../content/validate-content.js';
import { Course } from '../course.entity.js';
import { CoursesService } from '../courses.service.js';
import { CourseImage } from '../images/course-image.entity.js';
import {
  CourseImagesService,
  prepareImage,
} from '../images/course-images.service.js';
import { markdownToContent } from './markdown-to-content.js';
import { CourseMetadata, parseFrontMatter } from './parse-front-matter.js';
import { ParsedTerm, parseTerms } from './parse-terms.js';
import { PackageFiles } from './read-package.js';
import {
  insertTerms,
  sortTerms,
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
  // Termes de termes.json que l'import créera, et ceux déjà présents qu'il laissera tels quels.
  newTerms: TermReference[];
  duplicateTerms: TermReference[];
  // Chapitre de même titre déjà présent dans l'UE : l'import le remplacerait.
  existingCourse: { id: number; title: string } | null;
}

interface AnalysedPackage {
  metadata: CourseMetadata;
  document: ContentNode;
  images: Map<string, Buffer>;
  sectionCount: number;
  terms: ParsedTerm[];
}

@Injectable()
export class CourseImportService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ueService: UeService,
    private readonly imagesService: CourseImagesService,
    private readonly coursesService: CoursesService,
  ) {}

  async preview(files: PackageFiles): Promise<ImportPreview> {
    const analysed = analyse(files);
    const ue = await this.findUe(analysed.metadata.ueCode);
    const existing = await this.findExisting(ue, analysed.metadata.title);
    const terms = await sortTerms(this.dataSource.manager, analysed.terms);
    return {
      ...analysed.metadata,
      sectionCount: analysed.sectionCount,
      imageCount: analysed.images.size,
      termCount: analysed.terms.length,
      newTerms: terms.fresh.map(toReference),
      duplicateTerms: terms.duplicates.map(toReference),
      existingCourse: existing
        ? { id: existing.id, title: existing.title }
        : null,
    };
  }

  async import(files: PackageFiles, replace: boolean): Promise<Course> {
    const analysed = analyse(files);
    const ue = await this.findUe(analysed.metadata.ueCode);
    const existing = await this.findExisting(ue, analysed.metadata.title);
    if (existing && !replace) {
      throw new ConflictException(
        `Le chapitre « ${existing.title} » existe déjà dans ${ue.code} : confirmez son remplacement.`,
      );
    }
    const written: CourseImage[] = [];
    try {
      // Cours, images, contenu et termes sont enregistrés ensemble ou pas du tout.
      const { courseId, obsolete } = await this.dataSource.transaction(
        (manager) => this.write(manager, ue, existing, analysed, written),
      );
      await this.imagesService.removeFiles(obsolete);
      return await this.courses.findOneOrFail({
        where: { id: courseId },
        relations: { ue: true },
      });
    } catch (error) {
      await this.imagesService.removeFiles(written);
      throw error;
    }
  }

  private async write(
    manager: EntityManager,
    ue: Ue,
    existing: Course | null,
    analysed: AnalysedPackage,
    written: CourseImage[],
  ): Promise<{ courseId: number; obsolete: CourseImage[] }> {
    const { metadata } = analysed;
    const course = existing ?? (await this.insertAtRank(manager, ue, metadata));
    const obsolete = await manager.findBy(CourseImage, { courseId: course.id });
    await manager.delete(CourseImage, { courseId: course.id });
    const sources = new Map<string, string>();
    for (const [path, data] of analysed.images) {
      const image = await this.imagesService.upload(
        course.id,
        data,
        findAltText(analysed.document, path),
        manager,
      );
      written.push(image);
      sources.set(path, buildImageSource('courses', course.id, image.id));
    }
    const content = placeImages(analysed.document, sources);
    throwIfAny(validateContent(content));
    course.title = metadata.title;
    course.content = content;
    course.plainText = extractPlainText(content);
    await manager.save(course);
    const terms = await sortTerms(manager, analysed.terms);
    await insertTerms(manager, terms.fresh, {
      ueId: ue.id,
      courseId: course.id,
    });
    return { courseId: course.id, obsolete };
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
  const images = new Map<string, Buffer>();
  const errors = [...header.errors, ...converted.errors];
  for (const path of converted.imagePaths) {
    const data = files.images.get(path);
    if (!data) {
      errors.push(`cours.md référence « ${path} », absent du paquet.`);
    } else {
      images.set(path, data);
      errors.push(...checkImage(path, data));
    }
  }
  const terms = parseTerms(files.terms);
  errors.push(...terms.errors);
  if (!header.metadata || errors.length > 0) {
    throw new BadRequestException(errors.slice(0, 10));
  }
  return {
    metadata: header.metadata,
    document: converted.document,
    images,
    sectionCount: converted.sectionCount,
    terms: terms.terms,
  };
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

function findAltText(node: ContentNode, path: string): string {
  if (node.type === 'figure' && node.attrs?.['src'] === path) {
    return typeof node.attrs['alt'] === 'string' ? node.attrs['alt'] : '';
  }
  for (const child of node.content ?? []) {
    const altText = findAltText(child, path);
    if (altText) {
      return altText;
    }
  }
  return '';
}

// Remplace, dans chaque figure, le chemin du paquet par l'adresse de l'image enregistrée.
function placeImages(
  node: ContentNode,
  sources: Map<string, string>,
): ContentNode {
  if (node.type === 'figure') {
    const path = String(node.attrs?.['src']);
    return {
      ...node,
      attrs: { ...node.attrs, src: sources.get(path) ?? path },
    };
  }
  return node.content
    ? {
        ...node,
        content: node.content.map((child) => placeImages(child, sources)),
      }
    : node;
}
