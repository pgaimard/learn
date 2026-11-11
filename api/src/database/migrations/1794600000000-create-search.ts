import { MigrationInterface, QueryRunner } from 'typeorm';

// Recherche plein texte en français, insensible aux accents : une configuration dédiée
// et, sur les cours et les termes, un vecteur de recherche tenu à jour par la base.
export class CreateSearch1794600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    await queryRunner.query(
      'CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french)',
    );
    await queryRunner.query(`
      ALTER TEXT SEARCH CONFIGURATION french_unaccent
        ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem
    `);
    await queryRunner.query(`
      ALTER TABLE courses ADD COLUMN search_vector tsvector NOT NULL
        GENERATED ALWAYS AS (
          setweight(to_tsvector('french_unaccent', title), 'A') ||
          setweight(to_tsvector('french_unaccent', plain_text), 'B')
        ) STORED
    `);
    await queryRunner.query(`
      ALTER TABLE terms ADD COLUMN search_vector tsvector NOT NULL
        GENERATED ALWAYS AS (
          setweight(
            to_tsvector('french_unaccent', label || ' ' || coalesce(expanded_form, '')),
            'A'
          ) ||
          setweight(to_tsvector('french_unaccent', plain_text), 'B')
        ) STORED
    `);
    await queryRunner.query(
      'CREATE INDEX courses_search_vector_idx ON courses USING gin (search_vector)',
    );
    await queryRunner.query(
      'CREATE INDEX terms_search_vector_idx ON terms USING gin (search_vector)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE terms DROP COLUMN search_vector');
    await queryRunner.query('ALTER TABLE courses DROP COLUMN search_vector');
    await queryRunner.query('DROP TEXT SEARCH CONFIGURATION french_unaccent');
    await queryRunner.query('DROP EXTENSION unaccent');
  }
}
