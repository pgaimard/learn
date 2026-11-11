import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'La recherche doit être un texte.' })
  @MinLength(2, {
    message: 'La recherche doit contenir au moins 2 caractères.',
  })
  @MaxLength(100, {
    message: 'La recherche ne doit pas dépasser 100 caractères.',
  })
  q!: string;
}
