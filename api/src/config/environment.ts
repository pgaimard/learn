import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export class Environment {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV!: (typeof NODE_ENVIRONMENTS)[number];

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD!: string;

  @IsString()
  @MinLength(32)
  SESSION_SECRET!: string;

  // Dossier des fichiers envoyés, hors de tout répertoire servi.
  @IsString()
  @IsNotEmpty()
  UPLOADS_DIR!: string;
}

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(environment);
  if (errors.length > 0) {
    const details = errors.map(
      (error) =>
        `- ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Configuration invalide :\n${details.join('\n')}`);
  }
  return environment;
}
