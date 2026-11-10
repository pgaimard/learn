import { IsOptional } from 'class-validator';
import { CreateUeDto } from './create-ue.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateUeDto extends CreateUeDto {
  @IsOptional()
  declare code: string;

  @IsOptional()
  declare title: string;
}
