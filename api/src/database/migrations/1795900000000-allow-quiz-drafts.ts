import { MigrationInterface, QueryRunner } from 'typeorm';

// Un QCM commencé se reprend plus tard : il a lui aussi un brouillon, fait de ses cases
// cochées. La contrainte qui réservait le brouillon aux exercices est levée.
export class AllowQuizDrafts1795900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE exercise_attempts
        DROP CONSTRAINT exercise_attempts_draft_check
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM exercise_attempts WHERE kind = 'quiz' AND submitted_at IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE exercise_attempts
        ADD CONSTRAINT exercise_attempts_draft_check
          CHECK (kind = 'exercise' OR submitted_at IS NOT NULL)
    `);
  }
}
