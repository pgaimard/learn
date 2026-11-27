import { IsInt, IsObject, IsOptional } from 'class-validator';
import { CreateCourseDto } from './create-course.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateCourseDto extends CreateCourseDto {
  @IsOptional()
  declare title: string;

  // Révision du cours lue avant de le modifier : s'il a changé depuis, l'enregistrement
  // est refusé au lieu d'écraser l'autre modification.
  @IsInt({ message: 'La révision lue du cours est requise.' })
  revision!: number;

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
