import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { Environment } from '../config/environment.js';
import { DatabaseDumper } from './database-dumper.js';
import { run } from './run.js';

export interface ExportArchive {
  name: string;
  stream: Readable;
}

// Horodatage des sauvegardes, en UTC : 2026-01-31T0315Z.
export function backupStamp(date: Date): string {
  return `${date.toISOString().slice(0, 13)}${date.toISOString().slice(14, 16)}Z`;
}

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);
  private readonly uploadsDirectory: string;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly dumper: DatabaseDumper,
  ) {
    this.uploadsDirectory = resolve(config.get('UPLOADS_DIR', { infer: true }));
  }

  // Archive de toute la donnée : l'export de la base et les fichiers envoyés, sous les
  // noms et aux formats de la sauvegarde quotidienne, pour que deploy/restore.sh la relise.
  async create(now = new Date()): Promise<ExportArchive> {
    const stamp = backupStamp(now);
    const dump = `learn-${stamp}.dump`;
    const uploads = `learn-${stamp}-uploads.tar.gz`;
    const work = await mkdtemp(join(tmpdir(), 'learn-export-'));
    try {
      await this.dumper.dumpTo(join(work, dump));
      await this.archiveUploads(work, uploads);
    } catch (error) {
      await rm(work, { recursive: true, force: true });
      this.logger.error(error);
      throw new InternalServerErrorException('L’export a échoué.');
    }
    return {
      name: `learn-${stamp}.tar`,
      stream: this.streamArchive(work, [dump, uploads]),
    };
  }

  // Les fichiers sont rangés sous « uploads/ », quel que soit le nom du dossier réel : un
  // lien de ce nom y mène, et tar le suit.
  private async archiveUploads(work: string, name: string): Promise<void> {
    await mkdir(this.uploadsDirectory, { recursive: true });
    const links = join(work, 'links');
    await mkdir(links);
    await symlink(this.uploadsDirectory, join(links, 'uploads'));
    await run('tar', ['-czhf', join(work, name), '-C', links, 'uploads']);
  }

  // Envoie l'archive au fil de sa fabrication ; le dossier de travail est supprimé à la fin,
  // que le téléchargement aille au bout ou non.
  private streamArchive(work: string, names: string[]): Readable {
    const tar = spawn('tar', ['-cf', '-', '-C', work, ...names], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const cleanUp = (): void => {
      tar.kill();
      void rm(work, { recursive: true, force: true });
    };
    tar.on('error', (error) => tar.stdout.destroy(error));
    tar.stdout.on('close', cleanUp);
    return tar.stdout;
  }
}
