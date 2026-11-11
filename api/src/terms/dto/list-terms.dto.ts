import { IsIn, IsOptional, IsString } from 'class-validator';
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
}
