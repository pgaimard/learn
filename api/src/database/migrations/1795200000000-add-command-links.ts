import { MigrationInterface, QueryRunner } from 'typeorm';

// UE et cours où une commande sert.
export class AddCommandLinks1795200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE command_ues (
        command_id integer NOT NULL REFERENCES commands (id) ON DELETE CASCADE,
        ue_id integer NOT NULL REFERENCES ues (id) ON DELETE CASCADE,
        PRIMARY KEY (command_id, ue_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX command_ues_ue_id_idx ON command_ues (ue_id)',
    );
    await queryRunner.query(`
      CREATE TABLE command_courses (
        command_id integer NOT NULL REFERENCES commands (id) ON DELETE CASCADE,
        course_id integer NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
        PRIMARY KEY (command_id, course_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX command_courses_course_id_idx ON command_courses (course_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE command_courses');
    await queryRunner.query('DROP TABLE command_ues');
  }
}
