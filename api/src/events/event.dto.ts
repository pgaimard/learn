import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EVENT_TYPES } from './event.entity.js';
import type { EventType } from './event.entity.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const DATE_OPTIONS = { strict: true, strictSeparator: true };
const START_MESSAGE =
  'Le début doit être une date et une heure au format ISO 8601.';
const END_MESSAGE =
  'La fin doit être une date et une heure au format ISO 8601.';
const TYPE_MESSAGE = 'Le type doit être « course » ou « deadline ».';

export const MAX_OCCURRENCES = 60;

export class OccurrenceDto {
  @IsISO8601(DATE_OPTIONS, { message: START_MESSAGE })
  startsAt!: string;

  @IsISO8601(DATE_OPTIONS, { message: END_MESSAGE })
  endsAt!: string;
}

class EventDetailsDto {
  @Transform(trim)
  @IsString({ message: 'Le titre doit être un texte.' })
  @IsNotEmpty({ message: 'Le titre est requis.' })
  @MaxLength(200, { message: 'Le titre ne doit pas dépasser 200 caractères.' })
  title!: string;

  @IsIn(EVENT_TYPES, { message: TYPE_MESSAGE })
  type!: EventType;

  // null : événement sans UE.
  @IsOptional()
  @IsString({ message: 'Le code de l’UE doit être un texte.' })
  ueCode?: string | null;
}

// Une occurrence par événement à créer. La répétition hebdomadaire est calculée par le
// client, qui seul connaît le fuseau horaire (et ses changements d'heure) de l'utilisateur.
export class CreateEventsDto extends EventDetailsDto {
  @IsArray({ message: 'Les occurrences doivent être une liste.' })
  @ArrayMinSize(1, { message: 'Au moins une occurrence est requise.' })
  @ArrayMaxSize(MAX_OCCURRENCES, {
    message: `Un événement ne peut pas être répété plus de ${MAX_OCCURRENCES} fois.`,
  })
  @ValidateNested({ each: true })
  @Type(() => OccurrenceDto)
  occurrences!: OccurrenceDto[];
}

export class UpdateEventDto extends EventDetailsDto {
  @IsOptional()
  declare title: string;

  @IsOptional()
  declare type: EventType;

  @IsOptional()
  @IsISO8601(DATE_OPTIONS, { message: START_MESSAGE })
  startsAt?: string;

  @IsOptional()
  @IsISO8601(DATE_OPTIONS, { message: END_MESSAGE })
  endsAt?: string;
}

// Événements qui recoupent la période [from, to[.
export class ListEventsDto {
  @IsISO8601(DATE_OPTIONS, {
    message: 'Le début de période est requis, au format ISO 8601.',
  })
  from!: string;

  @IsISO8601(DATE_OPTIONS, {
    message: 'La fin de période est requise, au format ISO 8601.',
  })
  to!: string;

  @IsOptional()
  @IsString({ message: 'Le code de l’UE doit être un texte.' })
  ue?: string;
}
