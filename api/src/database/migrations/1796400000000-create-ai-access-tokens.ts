import { MigrationInterface, QueryRunner } from 'typeorm';

// Jeton d'accès de l'IA au serveur MCP : seule son empreinte est conservée.
export class CreateAiAccessTokens1796400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_access_tokens (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE ai_access_tokens');
  }
}
