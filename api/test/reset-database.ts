import { DataSource } from 'typeorm';

// Repart d'un schéma vide à jour : chaque fichier de test est indépendant des autres.
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
}
