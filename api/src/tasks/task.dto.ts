import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Un paramètre d'adresse arrive sous forme de texte.
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

const DATE_OPTIONS = { strict: true, strictSeparator: true };

export class CreateTaskDto {
  @Transform(trim)
  @IsString({ message: 'Le titre doit être un texte.' })
  @IsNotEmpty({ message: 'Le titre est requis.' })
  @MaxLength(200, { message: 'Le titre ne doit pas dépasser 200 caractères.' })
  title!: string;

  // null : tâche sans UE.
  @IsOptional()
  @IsString({ message: 'Le code de l’UE doit être un texte.' })
  ueCode?: string | null;

  // null : pas d'échéance.
  @IsOptional()
  @IsISO8601(DATE_OPTIONS, {
    message: 'L’échéance doit être une date et une heure au format ISO 8601.',
  })
  dueAt?: string | null;

  // null : pas de rappel.
  @IsOptional()
  @IsISO8601(DATE_OPTIONS, {
    message: 'Le rappel doit être une date et une heure au format ISO 8601.',
  })
  remindAt?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'L’état doit valoir vrai ou faux.' })
  done?: boolean;
}

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateTaskDto extends CreateTaskDto {
  @IsOptional()
  declare title: string;
}

export class ListTasksDto {
  @IsOptional()
  @IsString({ message: 'Le code de l’UE doit être un texte.' })
  ue?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'Le filtre « done » doit valoir true ou false.' })
  done?: boolean;

  // Tâches dont l'échéance tombe dans la période [dueFrom, dueTo[ (pour l'agenda).
  @IsOptional()
  @IsISO8601(DATE_OPTIONS, { message: 'Le début de période est invalide.' })
  dueFrom?: string;

  @IsOptional()
  @IsISO8601(DATE_OPTIONS, { message: 'La fin de période est invalide.' })
  dueTo?: string;
}
