import { MigrationInterface, QueryRunner } from 'typeorm';

// Marque-page de lecture d'un cours : le titre où l'on s'est arrêté, et le rang de son
// bloc pour le distinguer d'un autre titre de même texte.
export class AddCourseBookmark1795400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE courses
        ADD COLUMN bookmark_title text,
        ADD COLUMN bookmark_block integer,
        ADD CONSTRAINT courses_bookmark_check
          CHECK ((bookmark_title IS NULL) = (bookmark_block IS NULL))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE courses
        DROP CONSTRAINT courses_bookmark_check,
        DROP COLUMN bookmark_block,
        DROP COLUMN bookmark_title
    `);
  }
}
