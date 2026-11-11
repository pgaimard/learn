import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

// Repart d'un schéma vide à jour et d'un dossier d'images vide : chaque fichier de test
// est indépendant des autres.
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
  const images = join(process.env.UPLOADS_DIR ?? '', 'course-images');
  if (!images.includes('learn-test-uploads')) {
    throw new Error('Le dossier de fichiers de test est mal configuré.');
  }
  await rm(images, { recursive: true, force: true });
  await mkdir(images, { recursive: true });
}
