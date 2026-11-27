import { MigrationInterface, QueryRunner } from 'typeorm';

// Cours ouvert dans l'éditeur : l'instant jusqu'auquel il est tenu pour « en édition ».
// L'éditeur le repousse tant qu'il reste ouvert ; passé cet instant, le cours est libre.
export class AddCourseEditing1796200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE courses ADD COLUMN editing_until timestamptz',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE courses DROP COLUMN editing_until');
  }
}
