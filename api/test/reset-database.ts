import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

// Repart d'un schéma vide à jour et de dossiers de fichiers vides : chaque fichier de test
// est indépendant des autres.
// Vide le schéma. dropDatabase ne supprime que les tables : la configuration de
// recherche lui survit et doit être retirée à part.
export async function dropSchema(dataSource: DataSource): Promise<void> {
  await dataSource.dropDatabase();
  await dataSource.query(
    'DROP TEXT SEARCH CONFIGURATION IF EXISTS french_unaccent',
  );
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dropSchema(dataSource);
  await dataSource.runMigrations();
  for (const name of ['course-images', 'files']) {
    const directory = join(process.env.UPLOADS_DIR ?? '', name);
    if (!directory.includes('learn-test-uploads')) {
      throw new Error('Le dossier de fichiers de test est mal configuré.');
    }
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
  }
}
