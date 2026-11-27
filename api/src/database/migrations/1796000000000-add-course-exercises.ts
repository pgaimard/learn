import { MigrationInterface, QueryRunner } from 'typeorm';

// Exercices d'un cours : un troisième document, au même format que le cours et sa fiche
// de révision. C'est le seul où se placent les QCM et les exercices.
export class AddCourseExercises1796000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE courses ADD COLUMN exercises_content jsonb',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE courses DROP COLUMN exercises_content',
    );
  }
}
