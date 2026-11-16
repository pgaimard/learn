import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class SetBookmarkDto {
  // Texte du titre où la lecture s'est arrêtée.
  @IsString({ message: 'Le titre marqué doit être un texte.' })
  @MaxLength(500, {
    message: 'Le titre marqué ne doit pas dépasser 500 caractères.',
  })
  title!: string;

  // Rang du bloc de ce titre dans le cours.
  @IsInt({ message: 'Le rang du bloc marqué doit être un entier.' })
  @Min(0, { message: 'Le rang du bloc marqué ne peut pas être négatif.' })
  @Max(100_000, { message: 'Le rang du bloc marqué est trop grand.' })
  block!: number;
}
