import { MigrationInterface, QueryRunner } from 'typeorm';

// Réponses données aux exercices et aux QCM d'un cours. Une tentative sans date de
// validation est le brouillon en cours : il y en a un au plus par exercice.
export class CreateExerciseAttempts1795800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE exercise_attempts (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        course_id integer NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
        exercise_key text NOT NULL,
        kind text NOT NULL,
        answer jsonb,
        score numeric(5, 2),
        max_score numeric(5, 2),
        submitted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exercise_attempts_key_check
          CHECK (exercise_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
        CONSTRAINT exercise_attempts_kind_check
          CHECK (kind IN ('exercise', 'quiz')),
        CONSTRAINT exercise_attempts_score_check
          CHECK (
            (score IS NULL AND max_score IS NULL)
            OR (score >= 0 AND max_score > 0 AND score <= max_score)
          ),
        -- Seul un exercice a un brouillon ; un QCM n'est enregistré qu'une fois validé.
        CONSTRAINT exercise_attempts_draft_check
          CHECK (kind = 'exercise' OR submitted_at IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX exercise_attempts_draft_key
        ON exercise_attempts (course_id, exercise_key)
        WHERE submitted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX exercise_attempts_history_idx
        ON exercise_attempts (course_id, exercise_key, submitted_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE exercise_attempts');
  }
}
