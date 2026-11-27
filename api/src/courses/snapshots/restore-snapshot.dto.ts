import { IsInt } from 'class-validator';

export class RestoreSnapshotDto {
  // Révision du cours lue avant de restaurer : s'il a changé depuis, la restauration est
  // refusée.
  @IsInt({ message: 'La révision lue du cours est requise.' })
  revision!: number;
}
