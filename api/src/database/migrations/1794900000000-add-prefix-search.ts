import { MigrationInterface, QueryRunner } from 'typeorm';

// Recherche par début de mot. Le vecteur existant contient des racines (« notes » et
// « noter » y deviennent « not ») : y chercher un début de mot confond « notes » et
// « notions ». Ce second vecteur garde les mots entiers, sans accents.
export class AddPrefixSearch1794900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TEXT SEARCH CONFIGURATION simple_unaccent (COPY = simple)',
    );
    await queryRunner.query(`
      ALTER TEXT SEARCH CONFIGURATION simple_unaccent
        ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple
    `);
    await queryRunner.query(`
      ALTER TABLE courses ADD COLUMN search_prefix_vector tsvector NOT NULL
        GENERATED ALWAYS AS (
          setweight(to_tsvector('simple_unaccent', title), 'A') ||
          setweight(to_tsvector('simple_unaccent', plain_text), 'B')
        ) STORED
    `);
    await queryRunner.query(`
      ALTER TABLE terms ADD COLUMN search_prefix_vector tsvector NOT NULL
        GENERATED ALWAYS AS (
          setweight(
            to_tsvector('simple_unaccent', label || ' ' || coalesce(expanded_form, '')),
            'A'
          ) ||
          setweight(to_tsvector('simple_unaccent', plain_text), 'B')
        ) STORED
    `);
    await queryRunner.query(`
      ALTER TABLE files ADD COLUMN search_prefix_vector tsvector NOT NULL
        GENERATED ALWAYS AS (
          to_tsvector('simple_unaccent', regexp_replace(name, '[._-]+', ' ', 'g'))
        ) STORED
    `);
    for (const table of ['courses', 'terms', 'files']) {
      await queryRunner.query(
        `CREATE INDEX ${table}_search_prefix_vector_idx ON ${table} USING gin (search_prefix_vector)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['files', 'terms', 'courses']) {
      await queryRunner.query(
        `ALTER TABLE ${table} DROP COLUMN search_prefix_vector`,
      );
    }
    await queryRunner.query('DROP TEXT SEARCH CONFIGURATION simple_unaccent');
  }
}
