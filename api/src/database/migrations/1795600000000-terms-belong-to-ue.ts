import { MigrationInterface, QueryRunner } from 'typeorm';

// Un terme appartient toujours à une UE : le même libellé peut exister dans deux UE.
// Les termes sans UE sont supprimés.
export class TermsBelongToUe1795600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM terms WHERE ue_id IS NULL');
    await queryRunner.query(
      'ALTER TABLE terms ALTER COLUMN ue_id SET NOT NULL',
    );
    await queryRunner.query(`
      ALTER TABLE terms
        DROP CONSTRAINT terms_ue_id_fkey,
        ADD CONSTRAINT terms_ue_id_fkey
          FOREIGN KEY (ue_id) REFERENCES ues (id) ON DELETE RESTRICT
    `);
    await queryRunner.query('DROP INDEX terms_type_label_key');
    await queryRunner.query(
      'CREATE UNIQUE INDEX terms_ue_id_type_label_key ON terms (ue_id, type, lower(label))',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX terms_ue_id_type_label_key');
    await queryRunner.query(
      'CREATE UNIQUE INDEX terms_type_label_key ON terms (type, lower(label))',
    );
    await queryRunner.query(`
      ALTER TABLE terms
        DROP CONSTRAINT terms_ue_id_fkey,
        ADD CONSTRAINT terms_ue_id_fkey
          FOREIGN KEY (ue_id) REFERENCES ues (id) ON DELETE SET NULL
    `);
    await queryRunner.query(
      'ALTER TABLE terms ALTER COLUMN ue_id DROP NOT NULL',
    );
  }
}
