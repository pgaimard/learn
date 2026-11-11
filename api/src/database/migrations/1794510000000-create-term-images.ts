import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTermImages1794510000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE term_images (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        term_id integer NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
        storage_name text NOT NULL UNIQUE,
        mime_type text NOT NULL,
        size integer NOT NULL,
        alt_text text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX term_images_term_id_idx ON term_images (term_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE term_images');
  }
}
