import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasks1794800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tasks (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        ue_id integer REFERENCES ues (id) ON DELETE SET NULL,
        title text NOT NULL,
        due_at timestamptz,
        remind_at timestamptz,
        done boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX tasks_ue_id_idx ON tasks (ue_id)');
    await queryRunner.query('CREATE INDEX tasks_due_at_idx ON tasks (due_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE tasks');
  }
}
