import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUes1794400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ues (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        code text NOT NULL UNIQUE,
        title text NOT NULL,
        description text NOT NULL DEFAULT '',
        position integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE ues');
  }
}
