import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { trim } from './create-tool.dto.js';

// La sortie d'un terminal garde son indentation : seule sa fin est nettoyée.
const trimEnd = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trimEnd() : value;

export class CommandOptionDto {
  @Transform(trim)
  @IsString({ message: 'Une option doit être un texte.' })
  @IsNotEmpty({ message: 'Le texte d’une option est requis.' })
  @MaxLength(200, {
    message: 'Une option ne doit pas dépasser 200 caractères.',
  })
  text!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La description d’une option doit être un texte.' })
  @MaxLength(1000, {
    message:
      'La description d’une option ne doit pas dépasser 1000 caractères.',
  })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Les déclinaisons d’une option sont une liste.' })
  @ArrayMaxSize(30, { message: 'Une option a 30 déclinaisons au plus.' })
  @IsInt({
    each: true,
    message: 'Une déclinaison est désignée par son numéro.',
  })
  variantIds?: number[];
}

export class CommandExampleDto {
  @Transform(trim)
  @IsString({ message: 'La ligne d’un exemple doit être un texte.' })
  @IsNotEmpty({ message: 'La ligne de commande d’un exemple est requise.' })
  @MaxLength(1000, {
    message: 'La ligne d’un exemple ne doit pas dépasser 1000 caractères.',
  })
  line!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'L’explication d’un exemple doit être un texte.' })
  @MaxLength(1000, {
    message: 'L’explication d’un exemple ne doit pas dépasser 1000 caractères.',
  })
  explanation?: string;

  @IsOptional()
  @Transform(trimEnd)
  @IsString({ message: 'La sortie d’un exemple doit être un texte.' })
  @MaxLength(10000, {
    message: 'La sortie d’un exemple ne doit pas dépasser 10 000 caractères.',
  })
  output?: string;
}

export class CreateCommandDto {
  @Transform(trim)
  @IsString({ message: 'Le nom doit être un texte.' })
  @IsNotEmpty({ message: 'Le nom est requis.' })
  @MaxLength(100, { message: 'Le nom ne doit pas dépasser 100 caractères.' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La description doit être un texte.' })
  @MaxLength(300, {
    message: 'La description ne doit pas dépasser 300 caractères.',
  })
  summary?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La syntaxe doit être un texte.' })
  @MaxLength(500, {
    message: 'La syntaxe ne doit pas dépasser 500 caractères.',
  })
  syntax?: string;

  // null : la commande ne demande aucun mode.
  @IsOptional()
  @IsInt({ message: 'Le mode est désigné par son numéro.' })
  modeId?: number | null;

  @IsOptional()
  @IsArray({ message: 'Les déclinaisons sont une liste.' })
  @ArrayMaxSize(30, { message: 'Une commande a 30 déclinaisons au plus.' })
  @IsInt({
    each: true,
    message: 'Une déclinaison est désignée par son numéro.',
  })
  variantIds?: number[];

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Les notes doivent être un texte.' })
  @MaxLength(5000, {
    message: 'Les notes ne doivent pas dépasser 5000 caractères.',
  })
  notes?: string;

  @IsOptional()
  @IsArray({ message: 'Les thèmes sont une liste.' })
  @ArrayMaxSize(10, { message: 'Une commande a 10 thèmes au plus.' })
  @IsString({ each: true, message: 'Un thème doit être un texte.' })
  @IsNotEmpty({ each: true, message: 'Un thème ne peut pas être vide.' })
  @MaxLength(40, {
    each: true,
    message: 'Un thème ne doit pas dépasser 40 caractères.',
  })
  themes?: string[];

  @IsOptional()
  @IsArray({ message: 'Les UE sont une liste de codes.' })
  @ArrayMaxSize(50, { message: 'Une commande sert dans 50 UE au plus.' })
  @IsString({ each: true, message: 'Une UE est désignée par son code.' })
  ueCodes?: string[];

  @IsOptional()
  @IsArray({ message: 'Les cours sont une liste.' })
  @ArrayMaxSize(100, { message: 'Une commande sert dans 100 cours au plus.' })
  @IsInt({ each: true, message: 'Un cours est désigné par son numéro.' })
  courseIds?: number[];

  @IsOptional()
  @IsArray({ message: 'Les options sont une liste.' })
  @ArrayMaxSize(100, { message: 'Une commande a 100 options au plus.' })
  @ValidateNested({ each: true })
  @Type(() => CommandOptionDto)
  options?: CommandOptionDto[];

  @IsOptional()
  @IsArray({ message: 'Les exemples sont une liste.' })
  @ArrayMaxSize(50, { message: 'Une commande a 50 exemples au plus.' })
  @ValidateNested({ each: true })
  @Type(() => CommandExampleDto)
  examples?: CommandExampleDto[];
}
