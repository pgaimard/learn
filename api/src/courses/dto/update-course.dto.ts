import { IsOptional } from 'class-validator';
import { CreateCourseDto } from './create-course.dto.js';

// Mêmes règles qu'à la création, tous les champs devenant facultatifs.
export class UpdateCourseDto extends CreateCourseDto {
  @IsOptional()
  declare title: string;
}
