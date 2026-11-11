import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFolders1794700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE folders (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        ue_id integer NOT NULL REFERENCES ues (id) ON DELETE RESTRICT,
        parent_id integer REFERENCES folders (id) ON DELETE RESTRICT,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Deux dossiers frères ne portent pas le même nom, à la racine de l'UE non plus
    // (NULLS NOT DISTINCT : deux parents absents comptent comme le même parent).
    await queryRunner.query(`
      CREATE UNIQUE INDEX folders_sibling_name_key
        ON folders (ue_id, parent_id, lower(name)) NULLS NOT DISTINCT
    `);
    await queryRunner.query(
      'CREATE INDEX folders_parent_id_idx ON folders (parent_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE folders');
  }
}
