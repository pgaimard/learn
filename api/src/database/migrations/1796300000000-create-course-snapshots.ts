import { MigrationInterface, QueryRunner } from 'typeorm';

// Instantané d'un cours : son état complet juste avant une écriture qui ne vient pas de
// l'éditeur (remplacement par un paquet, restauration, IA), pour pouvoir y revenir.
export class CreateCourseSnapshots1796300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE course_snapshots (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        course_id integer NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
        origin text NOT NULL,
        revision integer NOT NULL,
        title text NOT NULL,
        content jsonb NOT NULL,
        sheet_content jsonb,
        exercises_content jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT course_snapshots_origin_check
          CHECK (origin IN ('ai', 'package', 'restore'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX course_snapshots_course_id_idx ON course_snapshots (course_id, id DESC)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE course_snapshots');
  }
}
