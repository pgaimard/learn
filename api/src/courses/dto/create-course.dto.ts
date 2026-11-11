import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCourseDto {
  @Transform(trim)
  @IsString({ message: 'Le titre doit être un texte.' })
  @IsNotEmpty({ message: 'Le titre est requis.' })
  @MaxLength(200, { message: 'Le titre ne doit pas dépasser 200 caractères.' })
  title!: string;

  // La structure fine du document est vérifiée par la liste blanche du service.
  @IsOptional()
  @IsObject({ message: 'Le contenu doit être un document de l’éditeur.' })
  content?: Record<string, unknown>;
}
