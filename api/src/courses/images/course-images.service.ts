import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { ReadStream } from 'node:fs';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { FigureReference } from '../content/collect-figures.js';
import { Course } from '../course.entity.js';
import { CourseImage } from './course-image.entity.js';
import { detectImageType, IMAGE_EXTENSIONS } from './detect-image-type.js';
import { ImageStorageService } from './image-storage.service.js';
import { sanitizeSvg } from './sanitize-svg.js';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@Injectable()
export class CourseImagesService {
  constructor(
    @InjectRepository(CourseImage)
    private readonly images: Repository<CourseImage>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    private readonly storage: ImageStorageService,
  ) {}

  async upload(
    courseId: number,
    data: Buffer,
    altText: string,
    manager: EntityManager = this.images.manager,
  ): Promise<CourseImage> {
    if (!(await manager.existsBy(Course, { id: courseId }))) {
      throw new NotFoundException('Ce cours n’existe pas.');
    }
    const { content, mimeType } = prepareImage(data);
    const storageName = `${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    await this.storage.write(storageName, content);
    try {
      return await manager.save(
        manager.create(CourseImage, {
          courseId,
          storageName,
          mimeType,
          size: content.length,
          altText,
        }),
      );
    } catch (error) {
      await this.storage.remove(storageName);
      throw error;
    }
  }

  async open(
    courseId: number,
    imageId: number,
  ): Promise<{ image: CourseImage; stream: ReadStream }> {
    const image = await this.images.findOneBy({ id: imageId, courseId });
    if (!image) {
      throw new NotFoundException('Cette image n’existe pas.');
    }
    return { image, stream: this.storage.open(image.storageName) };
  }

  findByCourse(courseId: number): Promise<CourseImage[]> {
    return this.images.findBy({ courseId });
  }

  // Refuse un contenu qui référence une image d'un autre cours ou une image inconnue.
  async assertFiguresExist(
    courseId: number,
    figures: FigureReference[],
  ): Promise<void> {
    const ids = [...new Set(figures.map((figure) => figure.imageId))];
    const isForeign = figures.some((figure) => figure.courseId !== courseId);
    const known = await this.images.countBy({ courseId, id: In(ids) });
    if (isForeign || known !== ids.length) {
      throw new BadRequestException(
        'Le contenu référence une image qui n’appartient pas à ce cours.',
      );
    }
  }

  // Aligne les images sur le contenu enregistré : met à jour les textes alternatifs et
  // supprime les lignes des images qui ne sont plus utilisées. Renvoie ces dernières,
  // dont les fichiers restent à effacer une fois la transaction validée.
  async reconcile(
    manager: EntityManager,
    courseId: number,
    figures: FigureReference[],
  ): Promise<CourseImage[]> {
    for (const figure of figures) {
      await manager.update(
        CourseImage,
        { id: figure.imageId, courseId },
        { altText: figure.altText },
      );
    }
    const usedIds = figures.map((figure) => figure.imageId);
    const unused = await manager.findBy(CourseImage, {
      courseId,
      id: Not(In(usedIds)),
    });
    await manager.remove([...unused]);
    return unused;
  }

  async removeFiles(images: CourseImage[]): Promise<void> {
    await Promise.all(
      images.map((image) => this.storage.remove(image.storageName)),
    );
  }
}

function prepareImage(data: Buffer): {
  content: Buffer;
  mimeType: keyof typeof IMAGE_EXTENSIONS;
} {
  if (data.length > MAX_IMAGE_SIZE) {
    throw new PayloadTooLargeException(
      'L’image dépasse la taille maximale de 5 Mo.',
    );
  }
  const mimeType = detectImageType(data);
  if (!mimeType) {
    throw new BadRequestException(
      'Format non pris en charge : seuls PNG, JPEG et SVG sont acceptés.',
    );
  }
  if (mimeType !== 'image/svg+xml') {
    return { content: data, mimeType };
  }
  const clean = sanitizeSvg(data.toString('utf8'));
  if (clean === null) {
    throw new BadRequestException('Ce fichier SVG est illisible.');
  }
  return { content: Buffer.from(clean, 'utf8'), mimeType };
}
