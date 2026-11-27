import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GenerateAiAccessDto {
  @IsString({ message: 'Le mot de passe doit être un texte.' })
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MaxLength(200, { message: 'Le mot de passe est trop long.' })
  password!: string;
}
