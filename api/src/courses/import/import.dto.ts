import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// Un formulaire multipart transmet « true » sous forme de texte.
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class PackageImportDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'Le remplacement doit valoir vrai ou faux.' })
  replace?: boolean;
}

export class MarkdownPreviewDto {
  @IsString({ message: 'Le Markdown doit être un texte.' })
  @MaxLength(1_000_000, { message: 'Le Markdown dépasse la taille maximale.' })
  markdown!: string;
}

export class MarkdownImportDto extends MarkdownPreviewDto {
  @IsOptional()
  @IsBoolean({ message: 'Le remplacement doit valoir vrai ou faux.' })
  replace?: boolean;
}
