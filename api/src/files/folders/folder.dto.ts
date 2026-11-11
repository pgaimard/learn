import { IsInt, IsOptional } from 'class-validator';
import { IsEntryName } from '../entry-name.js';

export class CreateFolderDto {
  @IsEntryName()
  name!: string;

  @IsOptional()
  @IsInt({ message: 'Le dossier parent doit être désigné par son numéro.' })
  parentId?: number | null;
}

export class RenameFolderDto {
  @IsEntryName()
  name!: string;
}
