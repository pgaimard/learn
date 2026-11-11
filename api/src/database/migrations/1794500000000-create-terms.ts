import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTerms1794500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE terms (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        type text NOT NULL,
        label text NOT NULL,
        expanded_form text,
        content jsonb NOT NULL,
        plain_text text NOT NULL DEFAULT '',
        ue_id integer REFERENCES ues (id) ON DELETE SET NULL,
        course_id integer REFERENCES courses (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT terms_type_check CHECK (type IN ('definition', 'acronym')),
        CONSTRAINT terms_expanded_form_check
          CHECK ((type = 'acronym') = (expanded_form IS NOT NULL))
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX terms_type_label_key ON terms (type, lower(label))',
    );
    await queryRunner.query('CREATE INDEX terms_ue_id_idx ON terms (ue_id)');
    await queryRunner.query(
      'CREATE INDEX terms_course_id_idx ON terms (course_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE terms');
  }
}
