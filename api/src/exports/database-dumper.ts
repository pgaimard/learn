import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../config/environment.js';
import { run } from './run.js';

// Exporte la base avec pg_dump, au format de la sauvegarde quotidienne (deploy/backup.sh).
@Injectable()
export class DatabaseDumper {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async dumpTo(path: string): Promise<void> {
    await run(
      'pg_dump',
      [
        '--format=custom',
        `--file=${path}`,
        `--host=${this.config.get('DATABASE_HOST', { infer: true })}`,
        `--port=${this.config.get('DATABASE_PORT', { infer: true })}`,
        `--username=${this.config.get('DATABASE_USER', { infer: true })}`,
        `--dbname=${this.config.get('DATABASE_NAME', { infer: true })}`,
      ],
      // Le mot de passe passe par l'environnement du processus : la ligne de commande
      // est lisible par les autres processus.
      { PGPASSWORD: this.config.get('DATABASE_PASSWORD', { infer: true }) },
    );
  }
}
