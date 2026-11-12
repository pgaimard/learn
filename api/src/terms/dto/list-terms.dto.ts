import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TERM_TYPES } from '../term.entity.js';
import type { TermType } from '../term.entity.js';

export class ListTermsDto {
  @IsOptional()
  @IsIn(TERM_TYPES, {
    message: 'Le type doit être « definition » ou « acronym ».',
  })
  type?: TermType;

  @IsOptional()
  @IsString({ message: 'Le code de l’UE doit être un texte.' })
  ue?: string;

  // Termes issus d'un cours donné.
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le cours doit être désigné par son identifiant.' })
  @Min(1, { message: 'Le cours doit être désigné par son identifiant.' })
  course?: number;
}
