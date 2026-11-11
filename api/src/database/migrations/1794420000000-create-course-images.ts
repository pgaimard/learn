import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseImages1794420000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE course_images (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        course_id integer NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
        storage_name text NOT NULL UNIQUE,
        mime_type text NOT NULL,
        size integer NOT NULL,
        alt_text text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX course_images_course_id_idx ON course_images (course_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE course_images');
  }
}
