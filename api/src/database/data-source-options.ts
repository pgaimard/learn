import { DataSourceOptions } from 'typeorm';
import { Environment } from '../config/environment.js';
import { migrations } from './migrations/index.js';

export type DatabaseEnvironment = Pick<
  Environment,
  | 'DATABASE_HOST'
  | 'DATABASE_PORT'
  | 'DATABASE_NAME'
  | 'DATABASE_USER'
  | 'DATABASE_PASSWORD'
>;

export function buildDataSourceOptions(
  environment: DatabaseEnvironment,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: environment.DATABASE_HOST,
    port: environment.DATABASE_PORT,
    database: environment.DATABASE_NAME,
    username: environment.DATABASE_USER,
    password: environment.DATABASE_PASSWORD,
    migrations,
    migrationsTransactionMode: 'each',
    synchronize: false,
  };
}
