import { MigrationInterface, QueryRunner } from 'typeorm';

// Recherche globale sur les outils et les commandes. Le texte d'une commande (syntaxe,
// options, exemples, notes) est dérivé à chaque enregistrement, comme celui d'un cours ;
// celui des commandes déjà saisies est calculé ici.
export class AddToolsSearch1795300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE commands ADD COLUMN plain_text text NOT NULL DEFAULT ''",
    );
    await queryRunner.query(`
      UPDATE commands command SET plain_text = concat_ws(E'\\n',
        nullif(command.syntax, ''),
        (SELECT string_agg(concat_ws(' ', option.text, nullif(option.description, '')),
                           E'\\n' ORDER BY option.position)
           FROM command_options option WHERE option.command_id = command.id),
        (SELECT string_agg(concat_ws(E'\\n', nullif(example.explanation, ''), example.line),
                           E'\\n' ORDER BY example.position)
           FROM command_examples example WHERE example.command_id = command.id),
        nullif(command.notes, ''))
    `);
    for (const table of ['tools', 'commands']) {
      await queryRunner.query(`
        ALTER TABLE ${table} ADD COLUMN search_vector tsvector NOT NULL
          GENERATED ALWAYS AS (
            setweight(to_tsvector('french_unaccent', name || ' ' || summary), 'A') ||
            setweight(to_tsvector('french_unaccent', plain_text), 'B')
          ) STORED
      `);
      await queryRunner.query(`
        ALTER TABLE ${table} ADD COLUMN search_prefix_vector tsvector NOT NULL
          GENERATED ALWAYS AS (
            setweight(to_tsvector('simple_unaccent', name || ' ' || summary), 'A') ||
            setweight(to_tsvector('simple_unaccent', plain_text), 'B')
          ) STORED
      `);
      await queryRunner.query(
        `CREATE INDEX ${table}_search_vector_idx ON ${table} USING gin (search_vector)`,
      );
      await queryRunner.query(
        `CREATE INDEX ${table}_search_prefix_vector_idx ON ${table} USING gin (search_prefix_vector)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['commands', 'tools']) {
      await queryRunner.query(
        `ALTER TABLE ${table} DROP COLUMN search_prefix_vector`,
      );
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN search_vector`);
    }
    await queryRunner.query('ALTER TABLE commands DROP COLUMN plain_text');
  }
}
