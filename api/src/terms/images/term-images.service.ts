import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { ReadStream } from 'node:fs';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { FigureReference } from '../../courses/content/collect-figures.js';
import { prepareImage } from '../../courses/images/course-images.service.js';
import { IMAGE_EXTENSIONS } from '../../courses/images/detect-image-type.js';
import { ImageStorageService } from '../../courses/images/image-storage.service.js';
import { Term } from '../term.entity.js';
import { TermImage } from './term-image.entity.js';

// Images des définitions : mêmes règles et même stockage que les images de cours.
@Injectable()
export class TermImagesService {
  constructor(
    @InjectRepository(TermImage)
    private readonly images: Repository<TermImage>,
    @InjectRepository(Term) private readonly terms: Repository<Term>,
    private readonly storage: ImageStorageService,
  ) {}

  async upload(
    termId: number,
    data: Buffer,
    altText: string,
  ): Promise<TermImage> {
    if (!(await this.terms.existsBy({ id: termId }))) {
      throw new NotFoundException('Ce terme n’existe pas.');
    }
    const { content, mimeType } = prepareImage(data);
    const storageName = `${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    await this.storage.write(storageName, content);
    try {
      return await this.images.save(
        this.images.create({
          termId,
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
    termId: number,
    imageId: number,
  ): Promise<{ image: TermImage; stream: ReadStream }> {
    const image = await this.images.findOneBy({ id: imageId, termId });
    if (!image) {
      throw new NotFoundException('Cette image n’existe pas.');
    }
    return { image, stream: this.storage.open(image.storageName) };
  }

  findByTerm(termId: number): Promise<TermImage[]> {
    return this.images.findBy({ termId });
  }

  // Refuse une définition qui référence une image inconnue, d'un autre terme ou d'un cours.
  async assertFiguresExist(
    termId: number,
    figures: FigureReference[],
  ): Promise<void> {
    const ids = [...new Set(figures.map((figure) => figure.imageId))];
    const isForeign = figures.some(
      (figure) => figure.owner !== 'terms' || figure.ownerId !== termId,
    );
    const known = await this.images.countBy({ termId, id: In(ids) });
    if (isForeign || known !== ids.length) {
      throw new BadRequestException(
        'La définition référence une image qui n’appartient pas à ce terme.',
      );
    }
  }

  // Aligne les images sur la définition enregistrée : met à jour les textes alternatifs
  // et supprime les lignes des images qui ne sont plus utilisées. Renvoie ces dernières,
  // dont les fichiers restent à effacer une fois la transaction validée.
  async reconcile(
    manager: EntityManager,
    termId: number,
    figures: FigureReference[],
  ): Promise<TermImage[]> {
    for (const figure of figures) {
      await manager.update(
        TermImage,
        { id: figure.imageId, termId },
        { altText: figure.altText },
      );
    }
    const usedIds = figures.map((figure) => figure.imageId);
    const unused = await manager.findBy(TermImage, {
      termId,
      id: Not(In(usedIds)),
    });
    await manager.remove([...unused]);
    return unused;
  }

  async removeFiles(images: TermImage[]): Promise<void> {
    await Promise.all(
      images.map((image) => this.storage.remove(image.storageName)),
    );
  }
}
