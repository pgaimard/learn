import { IsIn, IsOptional } from 'class-validator';

export class RemoveCourseDto {
  // Sort du dossier de fichiers du cours quand il n'est pas vide.
  @IsOptional()
  @IsIn(['keep', 'delete'], {
    message: 'Le sort du dossier doit être « keep » ou « delete ».',
  })
  folder?: 'keep' | 'delete';
}
