import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvents1794810000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE events (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        ue_id integer REFERENCES ues (id) ON DELETE SET NULL,
        title text NOT NULL,
        type text NOT NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT events_type_check CHECK (type IN ('course', 'deadline')),
        CONSTRAINT events_period_check CHECK (ends_at >= starts_at)
      )
    `);
    await queryRunner.query('CREATE INDEX events_ue_id_idx ON events (ue_id)');
    await queryRunner.query(
      'CREATE INDEX events_starts_at_idx ON events (starts_at)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE events');
  }
}
