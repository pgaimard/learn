import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment.js';
import { buildDataSourceOptions } from './data-source-options.js';

// Point d'entrée de la ligne de commande TypeORM (migrations).
export default new DataSource(
  buildDataSourceOptions(validateEnvironment(process.env)),
);
