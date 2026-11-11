import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Environment } from '../../config/environment.js';

// Fichiers d'images sur disque, hors de tout répertoire servi. Les noms sont générés
// par l'API ; on vérifie quand même qu'aucun ne sort du dossier.
@Injectable()
export class ImageStorageService implements OnModuleInit {
  private readonly directory: string;

  constructor(config: ConfigService<Environment, true>) {
    this.directory = join(
      config.get('UPLOADS_DIR', { infer: true }),
      'course-images',
    );
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  write(storageName: string, data: Buffer): Promise<void> {
    return writeFile(this.pathOf(storageName), data, { flag: 'wx' });
  }

  open(storageName: string): ReadStream {
    return createReadStream(this.pathOf(storageName));
  }

  remove(storageName: string): Promise<void> {
    return rm(this.pathOf(storageName), { force: true });
  }

  private pathOf(storageName: string): string {
    if (basename(storageName) !== storageName) {
      throw new Error('Nom de fichier de stockage invalide.');
    }
    return join(this.directory, storageName);
  }
}
