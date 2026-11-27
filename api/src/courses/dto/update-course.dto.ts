import { IsObject, IsOptional } from 'class-validator';
import { CreateCourseDto } from './create-course.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateCourseDto extends CreateCourseDto {
  @IsOptional()
  declare title: string;

  // Fiche de révision du cours ; null la supprime. Sa structure fine est vérifiée par
  // la liste blanche du service.
  @IsOptional()
  @IsObject({
    message: 'La fiche de révision doit être un document de l’éditeur.',
  })
  sheetContent?: Record<string, unknown> | null;

  // Exercices du cours ; null les supprime. Même vérification.
  @IsOptional()
  @IsObject({
    message: 'Les exercices doivent être un document de l’éditeur.',
  })
  exercisesContent?: Record<string, unknown> | null;
}
