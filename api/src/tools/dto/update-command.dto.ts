import { IsOptional } from 'class-validator';
import { CreateCommandDto } from './create-command.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateCommandDto extends CreateCommandDto {
  @IsOptional()
  declare name: string;
}
