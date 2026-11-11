import {
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { ReadStream } from 'node:fs';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { UeService } from '../ue/ue.service.js';
import { cleanUploadName, nextFreeName } from './file-name.js';
import { FileStorageService } from './file-storage.service.js';
import { UpdateFileDto } from './file.dto.js';
import { FoldersService } from './folders/folders.service.js';
import { StoredFile } from './stored-file.entity.js';

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
const UNIQUE_VIOLATION = '23505';
const DEFAULT_MIME_TYPE = 'application/octet-stream';
const MAX_MIME_TYPE_LENGTH = 255;

export type FileSummary = Pick<
  StoredFile,
  'id' | 'folderId' | 'name' | 'mimeType' | 'size' | 'updatedAt'
>;

export interface ReceivedUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(StoredFile)
    private readonly files: Repository<StoredFile>,
    private readonly ueService: UeService,
    private readonly foldersService: FoldersService,
    private readonly storage: FileStorageService,
  ) {}

  // Fichiers d'un dossier de l'UE, ou de sa racine quand aucun dossier n'est donné.
  async findAll(
    ueCode: string,
    folderId: number | null,
  ): Promise<FileSummary[]> {
    const ue = await this.ueService.findByCode(ueCode);
    if (folderId !== null) {
      await this.foldersService.assertInUe(folderId, ue.id);
    }
    const files = await this.files.find({
      where: { ueId: ue.id, folderId: folderId ?? IsNull() },
      order: { name: 'ASC', id: 'ASC' },
    });
    return files.map(toSummary);
  }

  async upload(
    ueCode: string,
    folderId: number | null,
    upload: ReceivedUpload,
  ): Promise<FileSummary> {
    if (upload.buffer.length > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        'Le fichier dépasse la taille maximale de 50 Mo.',
      );
    }
    const ue = await this.ueService.findByCode(ueCode);
    if (folderId !== null) {
      await this.foldersService.assertInUe(folderId, ue.id);
    }
    const storageName = randomUUID();
    await this.storage.write(storageName, upload.buffer);
    try {
      const file = this.files.create({
        ueId: ue.id,
        folderId,
        // Un nom déjà pris dans le dossier est numéroté : rien n'est jamais remplacé.
        name: await this.freeName(
          cleanUploadName(upload.originalname),
          ue.id,
          folderId,
        ),
        storageName,
        mimeType:
          upload.mimetype.slice(0, MAX_MIME_TYPE_LENGTH) || DEFAULT_MIME_TYPE,
        size: upload.buffer.length,
      });
      return toSummary(await this.save(file));
    } catch (error) {
      await this.storage.remove(storageName);
      throw error;
    }
  }

  async open(id: number): Promise<{ file: StoredFile; stream: ReadStream }> {
    const file = await this.files.findOne({
      where: { id },
      select: { id: true, name: true, size: true, storageName: true },
    });
    if (!file) {
      throw new NotFoundException('Ce fichier n’existe pas.');
    }
    return { file, stream: this.storage.open(file.storageName) };
  }

  // Renommage : le nom choisi est refusé s'il est pris. Déplacement seul : le nom est
  // numéroté s'il est pris dans le dossier d'arrivée.
  async update(id: number, changes: UpdateFileDto): Promise<FileSummary> {
    const file = await this.findById(id);
    if (changes.folderId !== undefined && changes.folderId !== file.folderId) {
      if (changes.folderId !== null) {
        await this.foldersService.assertInUe(changes.folderId, file.ueId);
      }
      file.folderId = changes.folderId;
      if (changes.name === undefined) {
        file.name = await this.freeName(file.name, file.ueId, file.folderId);
      }
    }
    file.name = changes.name ?? file.name;
    return toSummary(await this.save(file));
  }

  async remove(id: number): Promise<void> {
    const { file } = await this.open(id);
    await this.files.delete({ id });
    await this.storage.remove(file.storageName);
  }

  private async findById(id: number): Promise<StoredFile> {
    const file = await this.files.findOneBy({ id });
    if (!file) {
      throw new NotFoundException('Ce fichier n’existe pas.');
    }
    return file;
  }

  private async freeName(
    name: string,
    ueId: number,
    folderId: number | null,
  ): Promise<string> {
    const siblings = await this.files.find({
      select: { name: true },
      where: { ueId, folderId: folderId ?? IsNull() },
    });
    return nextFreeName(
      name,
      siblings.map((sibling) => sibling.name),
    );
  }

  private async save(file: StoredFile): Promise<StoredFile> {
    try {
      return await this.files.save(file);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException(
          `Un fichier « ${file.name} » existe déjà dans ce dossier.`,
        );
      }
      throw error;
    }
  }
}

function toSummary(file: StoredFile): FileSummary {
  const { id, folderId, name, mimeType, size, updatedAt } = file;
  return { id, folderId, name, mimeType, size, updatedAt };
}
