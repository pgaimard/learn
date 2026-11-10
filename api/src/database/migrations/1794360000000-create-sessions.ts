import { MigrationInterface, QueryRunner } from 'typeorm';

// Structure attendue par connect-pg-simple (colonnes sid, sess, expire).
export class CreateSessions1794360000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sessions (
        sid text PRIMARY KEY,
        sess json NOT NULL,
        expire timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX sessions_expire_idx ON sessions (expire)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE sessions');
  }
}
