import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourses1794410000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE courses (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        ue_id integer NOT NULL REFERENCES ues (id) ON DELETE RESTRICT,
        title text NOT NULL,
        position integer NOT NULL,
        content jsonb NOT NULL,
        plain_text text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT courses_ue_position_key UNIQUE (ue_id, position)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE courses');
  }
}
