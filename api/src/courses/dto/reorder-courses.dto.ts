import { ArrayMaxSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class ReorderCoursesDto {
  // Numéros de tous les cours de l'UE, dans l'ordre voulu.
  @IsArray({ message: 'L’ordre doit être une liste de numéros de cours.' })
  @ArrayMaxSize(1000, { message: 'La liste contient trop de cours.' })
  @ArrayUnique({ message: 'Un cours figure deux fois dans la liste.' })
  @IsInt({ each: true, message: 'Chaque cours est désigné par son numéro.' })
  ids!: number[];
}
