import { IsOptional } from 'class-validator';
import { CreateToolDto } from './create-tool.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateToolDto extends CreateToolDto {
  @IsOptional()
  declare name: string;
}
