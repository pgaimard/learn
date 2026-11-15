import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommands1795100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE commands (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        tool_id integer NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
        name text NOT NULL,
        summary text NOT NULL DEFAULT '',
        syntax text NOT NULL DEFAULT '',
        mode_id integer REFERENCES tool_modes (id) ON DELETE SET NULL,
        notes text NOT NULL DEFAULT '',
        themes text[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX commands_tool_id_name_key ON commands (tool_id, lower(name))',
    );
    await queryRunner.query(
      'CREATE INDEX commands_name_idx ON commands (lower(name))',
    );
    await queryRunner.query(
      'CREATE INDEX commands_mode_id_idx ON commands (mode_id)',
    );
    await queryRunner.query(`
      CREATE TABLE command_variants (
        command_id integer NOT NULL REFERENCES commands (id) ON DELETE CASCADE,
        variant_id integer NOT NULL REFERENCES tool_variants (id) ON DELETE CASCADE,
        PRIMARY KEY (command_id, variant_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX command_variants_variant_id_idx ON command_variants (variant_id)',
    );
    await queryRunner.query(`
      CREATE TABLE command_options (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        command_id integer NOT NULL REFERENCES commands (id) ON DELETE CASCADE,
        text text NOT NULL,
        description text NOT NULL DEFAULT '',
        position integer NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX command_options_command_id_idx ON command_options (command_id)',
    );
    await queryRunner.query(`
      CREATE TABLE command_option_variants (
        option_id integer NOT NULL REFERENCES command_options (id) ON DELETE CASCADE,
        variant_id integer NOT NULL REFERENCES tool_variants (id) ON DELETE CASCADE,
        PRIMARY KEY (option_id, variant_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX command_option_variants_variant_id_idx ON command_option_variants (variant_id)',
    );
    await queryRunner.query(`
      CREATE TABLE command_examples (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        command_id integer NOT NULL REFERENCES commands (id) ON DELETE CASCADE,
        line text NOT NULL,
        explanation text NOT NULL DEFAULT '',
        output text NOT NULL DEFAULT '',
        position integer NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX command_examples_command_id_idx ON command_examples (command_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE command_examples');
    await queryRunner.query('DROP TABLE command_option_variants');
    await queryRunner.query('DROP TABLE command_options');
    await queryRunner.query('DROP TABLE command_variants');
    await queryRunner.query('DROP TABLE commands');
  }
}
