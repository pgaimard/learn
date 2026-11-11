import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { IsEntryName } from './entry-name.js';

// Un paramètre d'adresse ou un champ de formulaire multipart arrive sous forme de texte.
const toInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

const FOLDER_MESSAGE = 'Le dossier doit être désigné par son numéro.';

export class ListFilesDto {
  @IsOptional()
  @Transform(toInteger)
  @IsInt({ message: FOLDER_MESSAGE })
  folder?: number;
}

export class UploadFileDto {
  @IsOptional()
  @Transform(toInteger)
  @IsInt({ message: FOLDER_MESSAGE })
  folderId?: number;
}

export class UpdateFileDto {
  @IsOptional()
  @IsEntryName()
  name?: string;

  // null : déplacement à la racine de l'UE.
  @IsOptional()
  @IsInt({ message: FOLDER_MESSAGE })
  folderId?: number | null;
}
