import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTools1795000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tools (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name text NOT NULL,
        summary text NOT NULL DEFAULT '',
        content jsonb NOT NULL,
        plain_text text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX tools_name_key ON tools (lower(name))',
    );
    await queryRunner.query(`
      CREATE TABLE tool_modes (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        tool_id integer NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
        name text NOT NULL,
        prompt text NOT NULL DEFAULT '',
        entry text NOT NULL DEFAULT '',
        position integer NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX tool_modes_tool_id_idx ON tool_modes (tool_id)',
    );
    await queryRunner.query(`
      CREATE TABLE tool_variants (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        tool_id integer NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
        name text NOT NULL,
        position integer NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX tool_variants_tool_id_idx ON tool_variants (tool_id)',
    );
    await queryRunner.query(`
      CREATE TABLE tool_ues (
        tool_id integer NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
        ue_id integer NOT NULL REFERENCES ues (id) ON DELETE CASCADE,
        PRIMARY KEY (tool_id, ue_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX tool_ues_ue_id_idx ON tool_ues (ue_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE tool_ues');
    await queryRunner.query('DROP TABLE tool_variants');
    await queryRunner.query('DROP TABLE tool_modes');
    await queryRunner.query('DROP TABLE tools');
  }
}
