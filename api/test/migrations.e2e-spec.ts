import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { createTestApp } from './create-test-app.js';

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

describe('Migrations', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await dataSource.dropDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  function readUserColumns(): Promise<ColumnRow[]> {
    return dataSource.query<ColumnRow[]>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      ['users'],
    );
  }

  async function readTableNames(): Promise<string[]> {
    const rows = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    return rows.map((row) => row.table_name);
  }

  it('crée les tables sur une base vide', async () => {
    await dataSource.runMigrations();

    expect(await readTableNames()).toEqual([
      'course_images',
      'courses',
      'migrations',
      'sessions',
      'ues',
      'users',
    ]);
    expect(await readUserColumns()).toEqual([
      { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'username', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'password_hash', data_type: 'text', is_nullable: 'NO' },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
  });

  it('refuse deux utilisateurs de même identifiant', async () => {
    const insert = (): Promise<unknown> =>
      dataSource.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        ['pierre', 'hash'],
      );

    await insert();

    await expect(insert()).rejects.toThrow(/unique/i);
  });

  it('s’annule proprement', async () => {
    for (let done = 0; done < dataSource.migrations.length; done++) {
      await dataSource.undoLastMigration();
    }

    expect(await readTableNames()).toEqual(['migrations']);
  });
});
