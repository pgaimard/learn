import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';

// Recrée la base de test à chaque exécution : les tests partent d'une base vide.
export default async function setup(project: TestProject): Promise<void> {
  const {
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
  } = project.config.env;
  if (!DATABASE_NAME?.endsWith('_test')) {
    throw new Error('La base de test doit avoir un nom terminé par « _test ».');
  }
  const maintenance = new DataSource({
    type: 'postgres',
    host: DATABASE_HOST,
    port: Number(DATABASE_PORT),
    database: 'postgres',
    username: DATABASE_USER,
    password: DATABASE_PASSWORD,
  });
  await maintenance.initialize();
  try {
    await maintenance.query(`DROP DATABASE IF EXISTS "${DATABASE_NAME}"`);
    await maintenance.query(`CREATE DATABASE "${DATABASE_NAME}"`);
  } finally {
    await maintenance.destroy();
  }
}
