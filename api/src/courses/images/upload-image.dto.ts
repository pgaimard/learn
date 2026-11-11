import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadImageDto {
  @IsOptional()
  @IsString({ message: 'Le texte alternatif doit être un texte.' })
  @MaxLength(500, {
    message: 'Le texte alternatif ne doit pas dépasser 500 caractères.',
  })
  altText?: string;
}
