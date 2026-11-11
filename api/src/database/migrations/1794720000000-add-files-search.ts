import { MigrationInterface, QueryRunner } from 'typeorm';

// Recherche sur les noms de fichiers. Les séparateurs usuels d'un nom de fichier comptent
// comme des espaces : « processus » trouve « TD3_processus-corrige.pdf ».
export class AddFilesSearch1794720000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE files ADD COLUMN search_vector tsvector NOT NULL
        GENERATED ALWAYS AS (
          to_tsvector('french_unaccent', regexp_replace(name, '[._-]+', ' ', 'g'))
        ) STORED
    `);
    await queryRunner.query(
      'CREATE INDEX files_search_vector_idx ON files USING gin (search_vector)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE files DROP COLUMN search_vector');
  }
}
