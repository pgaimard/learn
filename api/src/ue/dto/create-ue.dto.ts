import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndUppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateUeDto {
  @Transform(trimAndUppercase)
  @IsString({ message: 'Le code doit être un texte.' })
  @Matches(/^[A-Z0-9]{3,10}$/, {
    message:
      'Le code doit contenir de 3 à 10 lettres ou chiffres (ex. UTC502).',
  })
  code!: string;

  @Transform(trim)
  @IsString({ message: 'L’intitulé doit être un texte.' })
  @IsNotEmpty({ message: 'L’intitulé est requis.' })
  @MaxLength(200, {
    message: 'L’intitulé ne doit pas dépasser 200 caractères.',
  })
  title!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La description doit être un texte.' })
  @MaxLength(2000, {
    message: 'La description ne doit pas dépasser 2000 caractères.',
  })
  description?: string;

  @IsOptional()
  @IsInt({ message: 'L’ordre doit être un nombre entier.' })
  @Min(0, { message: 'L’ordre doit être positif.' })
  position?: number;
}
