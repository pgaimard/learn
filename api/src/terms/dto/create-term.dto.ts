import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TERM_TYPES } from '../term.entity.js';
import type { TermType } from '../term.entity.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTermDto {
  @IsIn(TERM_TYPES, {
    message: 'Le type doit être « definition » ou « acronym ».',
  })
  type!: TermType;

  @Transform(trim)
  @IsString({ message: 'Le libellé doit être un texte.' })
  @IsNotEmpty({ message: 'Le libellé est requis.' })
  @MaxLength(200, {
    message: 'Le libellé ne doit pas dépasser 200 caractères.',
  })
  label!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La forme développée doit être un texte.' })
  @MaxLength(300, {
    message: 'La forme développée ne doit pas dépasser 300 caractères.',
  })
  expandedForm?: string | null;

  // La structure fine du document est vérifiée par la liste blanche du service.
  @IsOptional()
  @IsObject({ message: 'La définition doit être un document de l’éditeur.' })
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString({ message: 'Le code de l’UE d’origine doit être un texte.' })
  ueCode?: string | null;

  @IsOptional()
  @IsInt({ message: 'Le cours d’origine doit être désigné par son numéro.' })
  courseId?: number | null;
}
