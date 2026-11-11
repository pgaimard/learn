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
import { CourseImage } from '../images/course-image.entity.js';
import {
  CourseImagesService,
  prepareImage,
} from '../images/course-images.service.js';
import { markdownToContent } from './markdown-to-content.js';
import { CourseMetadata, parseFrontMatter } from './parse-front-matter.js';
import { PackageFiles } from './read-package.js';

export interface ImportPreview {
  ueCode: string;
  title: string;
  position: number;
  sectionCount: number;
  imageCount: number;
  termCount: number;
  // Chapitre déjà présent à cet ordre dans l'UE : l'import le remplacerait.
  existingCourse: { id: number; title: string } | null;
}

interface AnalysedPackage {
  metadata: CourseMetadata;
  document: ContentNode;
  images: Map<string, Buffer>;
  sectionCount: number;
  termCount: number;
}

@Injectable()
export class CourseImportService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ueService: UeService,
    private readonly imagesService: CourseImagesService,
  ) {}

  async preview(files: PackageFiles): Promise<ImportPreview> {
    const analysed = analyse(files);
    const ue = await this.findUe(analysed.metadata.ueCode);
    const existing = await this.findExisting(ue, analysed.metadata.position);
    return {
      ...analysed.metadata,
      sectionCount: analysed.sectionCount,
      imageCount: analysed.images.size,
      termCount: analysed.termCount,
      existingCourse: existing
        ? { id: existing.id, title: existing.title }
        : null,
    };
  }

  async import(files: PackageFiles, replace: boolean): Promise<Course> {
    const analysed = analyse(files);
    const ue = await this.findUe(analysed.metadata.ueCode);
    const existing = await this.findExisting(ue, analysed.metadata.position);
    if (existing && !replace) {
      throw new ConflictException(
        `Un chapitre occupe déjà l’ordre ${existing.position} dans ${ue.code} : confirmez son remplacement.`,
      );
    }
    const written: CourseImage[] = [];
    try {
      // Cours, images et contenu sont enregistrés ensemble ou pas du tout.
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
    const course =
      existing ??
      (await manager.save(
        manager.create(Course, {
          ueId: ue.id,
          title: metadata.title,
          position: metadata.position,
          content: EMPTY_CONTENT,
          plainText: '',
        }),
      ));
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
    return { courseId: course.id, obsolete };
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

  private findExisting(ue: Ue, position: number): Promise<Course | null> {
    return this.courses.findOneBy({ ueId: ue.id, position });
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
  const terms = countTerms(files.terms, errors);
  if (!header.metadata || errors.length > 0) {
    throw new BadRequestException(errors.slice(0, 10));
  }
  return {
    metadata: header.metadata,
    document: converted.document,
    images,
    sectionCount: converted.sectionCount,
    termCount: terms,
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

function countTerms(terms: string | null, errors: string[]): number {
  if (terms === null) {
    return 0;
  }
  try {
    const parsed: unknown = JSON.parse(terms);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch {
    // Signalé ci-dessous, comme un contenu qui n'est pas une liste.
  }
  errors.push('termes.json doit contenir une liste d’entrées au format JSON.');
  return 0;
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
