import { IsInt, IsOptional } from 'class-validator';
import { IsEntryName } from '../entry-name.js';

export class CreateFolderDto {
  @IsEntryName()
  name!: string;

  @IsOptional()
  @IsInt({ message: 'Le dossier parent doit être désigné par son numéro.' })
  parentId?: number | null;
}

// Renommage, déplacement, ou les deux ; parentId null place le dossier à la racine.
export class UpdateFolderDto {
  @IsOptional()
  @IsEntryName()
  name?: string;

  @IsOptional()
  @IsInt({ message: 'Le dossier parent doit être désigné par son numéro.' })
  parentId?: number | null;
}
