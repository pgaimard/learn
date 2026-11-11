import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFiles1794710000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE files (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        ue_id integer NOT NULL REFERENCES ues (id) ON DELETE RESTRICT,
        folder_id integer REFERENCES folders (id) ON DELETE RESTRICT,
        name text NOT NULL,
        storage_name text NOT NULL UNIQUE,
        mime_type text NOT NULL,
        size integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Deux fichiers d'un même dossier (ou de la racine de l'UE) ne portent pas le même nom.
    await queryRunner.query(`
      CREATE UNIQUE INDEX files_sibling_name_key
        ON files (ue_id, folder_id, lower(name)) NULLS NOT DISTINCT
    `);
    await queryRunner.query(
      'CREATE INDEX files_folder_id_idx ON files (folder_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE files');
  }
}
