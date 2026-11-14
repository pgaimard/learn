import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ToolModeDto {
  // Présent pour un mode déjà enregistré, absent pour un nouveau.
  @IsOptional()
  @IsInt({ message: 'Un mode existant est désigné par son numéro.' })
  id?: number;

  @Transform(trim)
  @IsString({ message: 'Le nom d’un mode doit être un texte.' })
  @IsNotEmpty({ message: 'Le nom d’un mode est requis.' })
  @MaxLength(100, {
    message: 'Le nom d’un mode ne doit pas dépasser 100 caractères.',
  })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'L’invite d’un mode doit être un texte.' })
  @MaxLength(100, {
    message: 'L’invite d’un mode ne doit pas dépasser 100 caractères.',
  })
  prompt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La façon d’entrer dans un mode doit être un texte.' })
  @MaxLength(500, {
    message:
      'La façon d’entrer dans un mode ne doit pas dépasser 500 caractères.',
  })
  entry?: string;
}

export class ToolVariantDto {
  // Présent pour une déclinaison déjà enregistrée, absent pour une nouvelle.
  @IsOptional()
  @IsInt({ message: 'Une déclinaison existante est désignée par son numéro.' })
  id?: number;

  @Transform(trim)
  @IsString({ message: 'Le nom d’une déclinaison doit être un texte.' })
  @IsNotEmpty({ message: 'Le nom d’une déclinaison est requis.' })
  @MaxLength(50, {
    message: 'Le nom d’une déclinaison ne doit pas dépasser 50 caractères.',
  })
  name!: string;
}

export class CreateToolDto {
  @Transform(trim)
  @IsString({ message: 'Le nom doit être un texte.' })
  @IsNotEmpty({ message: 'Le nom est requis.' })
  @MaxLength(100, { message: 'Le nom ne doit pas dépasser 100 caractères.' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La présentation doit être un texte.' })
  @MaxLength(300, {
    message: 'La présentation ne doit pas dépasser 300 caractères.',
  })
  summary?: string;

  // La structure fine du document est vérifiée par la liste blanche du service.
  @IsOptional()
  @IsObject({
    message: 'Le fonctionnement doit être un document de l’éditeur.',
  })
  content?: Record<string, unknown>;

  @IsOptional()
  @IsArray({ message: 'Les UE sont une liste de codes.' })
  @ArrayMaxSize(50, { message: 'Un outil sert dans 50 UE au plus.' })
  @IsString({ each: true, message: 'Une UE est désignée par son code.' })
  ueCodes?: string[];

  @IsOptional()
  @IsArray({ message: 'Les modes sont une liste.' })
  @ArrayMaxSize(30, { message: 'Un outil a 30 modes au plus.' })
  @ValidateNested({ each: true })
  @Type(() => ToolModeDto)
  modes?: ToolModeDto[];

  @IsOptional()
  @IsArray({ message: 'Les déclinaisons sont une liste.' })
  @ArrayMaxSize(30, { message: 'Un outil a 30 déclinaisons au plus.' })
  @ValidateNested({ each: true })
  @Type(() => ToolVariantDto)
  variants?: ToolVariantDto[];
}
