import { MigrationInterface, QueryRunner } from 'typeorm';

// Fiche de révision rédigée d'un cours : un second document, au même format que le cours.
// Elle remplace la fiche calculée à partir des encadrés et des blocs épinglés.
export class AddCourseSheet1795500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE courses ADD COLUMN sheet_content jsonb',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE courses DROP COLUMN sheet_content');
  }
}
