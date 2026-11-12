import { MigrationInterface, QueryRunner } from 'typeorm';

// Description libre d'un événement ; vide quand il n'en a pas.
export class AddEventDescription1794910000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE events ADD COLUMN description text NOT NULL DEFAULT ''",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE events DROP COLUMN description');
  }
}
