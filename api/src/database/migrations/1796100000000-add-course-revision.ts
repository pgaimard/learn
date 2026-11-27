import { MigrationInterface, QueryRunner } from 'typeorm';

// Numéro de révision d'un cours, augmenté à chaque enregistrement : celui qui écrit dit
// quelle révision il a lue, et l'écriture est refusée si le cours a changé depuis.
export class AddCourseRevision1796100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE courses ADD COLUMN revision integer NOT NULL DEFAULT 1',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE courses DROP COLUMN revision');
  }
}
