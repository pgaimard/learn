import { IsOptional } from 'class-validator';
import type { TermType } from '../term.entity.js';
import { CreateTermDto } from './create-term.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateTermDto extends CreateTermDto {
  @IsOptional()
  declare type: TermType;

  @IsOptional()
  declare label: string;
}
