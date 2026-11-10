import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'L’identifiant doit être un texte.' })
  @IsNotEmpty({ message: 'L’identifiant est requis.' })
  @MaxLength(100, { message: 'L’identifiant est trop long.' })
  username!: string;

  @IsString({ message: 'Le mot de passe doit être un texte.' })
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MaxLength(200, { message: 'Le mot de passe est trop long.' })
  password!: string;
}
