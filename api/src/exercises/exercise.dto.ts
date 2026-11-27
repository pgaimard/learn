import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { AttemptKind } from './exercise-attempt.entity.js';

// Note d'un exercice : sur 20, au demi-point.
export const EXERCISE_MAX_SCORE = 20;
// Un QCM compte 50 questions au plus.
const QUIZ_MAX_SCORE = 50;

export class SaveDraftDto {
  // Réponse en cours à un exercice ; la structure fine du document est vérifiée par la
  // liste blanche du service.
  @ValidateIf((draft: SaveDraftDto) => draft.checked === undefined)
  @IsObject({ message: 'La réponse doit être un document de l’éditeur.' })
  answer?: Record<string, unknown>;

  // Cases cochées d'un QCM en cours : une liste par question, un booléen par choix.
  @ValidateIf((draft: SaveDraftDto) => draft.answer === undefined)
  @IsArray({ message: 'Les cases cochées sont une liste par question.' })
  @ArrayMaxSize(QUIZ_MAX_SCORE, { message: 'Le QCM a trop de questions.' })
  checked?: unknown[];
}

export class SubmitAttemptDto {
  @IsIn(['exercise', 'quiz'], {
    message: 'Le genre doit être « exercise » ou « quiz ».',
  })
  kind!: AttemptKind;

  // Réponse rédigée, pour un exercice.
  @ValidateIf((attempt: SubmitAttemptDto) => attempt.kind === 'exercise')
  @IsObject({ message: 'La réponse doit être un document de l’éditeur.' })
  answer?: Record<string, unknown>;

  // Nombre de bonnes réponses et nombre de questions, pour un QCM.
  @ValidateIf((attempt: SubmitAttemptDto) => attempt.kind === 'quiz')
  @IsInt({ message: 'Le score doit être un nombre entier.' })
  @Min(0, { message: 'Le score ne peut pas être négatif.' })
  @Max(QUIZ_MAX_SCORE, { message: 'Le score est trop grand.' })
  score?: number;

  @ValidateIf((attempt: SubmitAttemptDto) => attempt.kind === 'quiz')
  @IsInt({ message: 'Le nombre de questions doit être un nombre entier.' })
  @Min(1, { message: 'Un QCM a au moins une question.' })
  @Max(QUIZ_MAX_SCORE, { message: 'Le nombre de questions est trop grand.' })
  maxScore?: number;
}

export class GradeAttemptDto {
  // Note que l'on se donne ; null la retire.
  @ValidateIf((grade: GradeAttemptDto) => grade.score !== null)
  @IsNumber({}, { message: 'La note doit être un nombre.' })
  @Min(0, { message: 'La note ne peut pas être négative.' })
  @Max(EXERCISE_MAX_SCORE, {
    message: `La note ne dépasse pas ${EXERCISE_MAX_SCORE}.`,
  })
  score!: number | null;
}
