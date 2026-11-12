import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UeService } from '../../ue/ue.service.js';
import { StoredFile } from '../stored-file.entity.js';
import { CreateFolderDto, UpdateFolderDto } from './folder.dto.js';
import { Folder } from './folder.entity.js';

const UNIQUE_VIOLATION = '23505';

export type FolderSummary = Pick<Folder, 'id' | 'parentId' | 'name'>;

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder) private readonly folders: Repository<Folder>,
    @InjectRepository(StoredFile)
    private readonly files: Repository<StoredFile>,
    private readonly ueService: UeService,
  ) {}

  // Tous les dossiers de l'UE, à plat : l'arborescence se reconstruit par parentId.
  async findAllByUe(ueCode: string): Promise<FolderSummary[]> {
    const ue = await this.ueService.findByCode(ueCode);
    return this.folders.find({
      select: { id: true, parentId: true, name: true },
      where: { ueId: ue.id },
      order: { name: 'ASC', id: 'ASC' },
    });
  }

  async findById(id: number): Promise<Folder> {
    const folder = await this.folders.findOneBy({ id });
    if (!folder) {
      throw new NotFoundException('Ce dossier n’existe pas.');
    }
    return folder;
  }

  // Vérifie qu'un dossier désigné par le client existe bien dans l'UE.
  async assertInUe(folderId: number, ueId: number): Promise<void> {
    if (!(await this.folders.existsBy({ id: folderId, ueId }))) {
      throw new BadRequestException('Ce dossier n’existe pas dans cette UE.');
    }
  }

  async create(ueCode: string, input: CreateFolderDto): Promise<FolderSummary> {
    const ue = await this.ueService.findByCode(ueCode);
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      await this.assertInUe(parentId, ue.id);
    }
    const folder = this.folders.create({
      ueId: ue.id,
      parentId,
      name: input.name,
    });
    return toSummary(await this.save(folder));
  }

  async update(id: number, changes: UpdateFolderDto): Promise<FolderSummary> {
    const folder = await this.findById(id);
    if (changes.name !== undefined) {
      folder.name = changes.name;
    }
    if (
      changes.parentId !== undefined &&
      changes.parentId !== folder.parentId
    ) {
      if (changes.parentId !== null) {
        await this.assertInUe(changes.parentId, folder.ueId);
        await this.assertNotInside(changes.parentId, folder.id);
      }
      folder.parentId = changes.parentId;
    }
    return toSummary(await this.save(folder));
  }

  // Un dossier ne peut pas devenir son propre sous-dossier : la destination ne doit être
  // ni le dossier lui-même, ni un de ses descendants.
  private async assertNotInside(
    destinationId: number,
    folderId: number,
  ): Promise<void> {
    const ancestors = await this.folders.query<{ id: number }[]>(
      `WITH RECURSIVE ancestors AS (
         SELECT id, parent_id FROM folders WHERE id = $1
         UNION ALL
         SELECT parent.id, parent.parent_id
           FROM folders parent
           JOIN ancestors child ON parent.id = child.parent_id
       )
       SELECT id FROM ancestors WHERE id = $2`,
      [destinationId, folderId],
    );
    if (ancestors.length > 0) {
      throw new BadRequestException(
        'Un dossier ne peut pas être déplacé dans lui-même ni dans un de ses sous-dossiers.',
      );
    }
  }

  async remove(id: number): Promise<void> {
    const folder = await this.findById(id);
    const subfolders = await this.folders.countBy({ parentId: id });
    const files = await this.files.countBy({ folderId: id });
    if (subfolders + files > 0) {
      throw new ConflictException(
        `Le dossier « ${folder.name} » n’est pas vide : il contient ${subfolders} sous-dossier(s) et ${files} fichier(s).`,
      );
    }
    await this.folders.delete({ id });
  }

  private async save(folder: Folder): Promise<Folder> {
    try {
      return await this.folders.save(folder);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException(
          `Un dossier « ${folder.name} » existe déjà à cet endroit.`,
        );
      }
      throw error;
    }
  }
}

function toSummary({ id, parentId, name }: Folder): FolderSummary {
  return { id, parentId, name };
}
