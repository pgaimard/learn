import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderUesDto {
  // Codes de toutes les UE, dans l'ordre voulu.
  @IsArray({ message: 'L’ordre doit être une liste de codes d’UE.' })
  @ArrayMaxSize(500, { message: 'La liste contient trop d’UE.' })
  @ArrayUnique({ message: 'Une UE figure deux fois dans la liste.' })
  @IsString({ each: true, message: 'Chaque UE est désignée par son code.' })
  codes!: string[];
}
