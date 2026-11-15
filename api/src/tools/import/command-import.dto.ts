import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CommandPreviewDto {
  // Contenu du fichier commandes.json.
  @IsString({ message: 'Le fichier doit être un texte.' })
  @MaxLength(1_000_000, { message: 'Le fichier dépasse la taille maximale.' })
  content!: string;
}

export class CommandImportDto extends CommandPreviewDto {
  @IsOptional()
  @IsBoolean({ message: 'Le remplacement doit valoir vrai ou faux.' })
  replace?: boolean;
}
