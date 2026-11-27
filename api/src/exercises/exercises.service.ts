import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ContentNode } from '../courses/content/content-node.js';
import { isExerciseKey } from '../courses/content/content-schema.js';
import { validateContent } from '../courses/content/validate-content.js';
import { Course } from '../courses/course.entity.js';
import { ExerciseAttempt } from './exercise-attempt.entity.js';
import {
  EXERCISE_MAX_SCORE,
  GradeAttemptDto,
  SubmitAttemptDto,
} from './exercise.dto.js';

const MAX_ANSWER_LENGTH = 200_000;
const MAX_HISTORY = 200;

// Tentative validée, sans sa réponse : une ligne de l'historique.
export type AttemptSummary = Pick<
  ExerciseAttempt,
  'id' | 'kind' | 'score' | 'maxScore' | 'submittedAt'
>;

export interface ExerciseProgress {
  // Brouillon en cours, s'il y en a un.
  draft: ExerciseAttempt | null;
  // Tentatives validées, de la plus récente à la plus ancienne.
  attempts: AttemptSummary[];
}

// Réponses données aux exercices et aux QCM d'un cours : le brouillon en cours, les
// tentatives validées et leur note.
@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(ExerciseAttempt)
    private readonly attempts: Repository<ExerciseAttempt>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {}

  async progress(courseId: number, key: string): Promise<ExerciseProgress> {
    await this.checkTarget(courseId, key);
    const [draft, attempts] = await Promise.all([
      this.findDraft(courseId, key),
      this.attempts.find({
        select: {
          id: true,
          kind: true,
          score: true,
          maxScore: true,
          submittedAt: true,
        },
        where: { courseId, exerciseKey: key, submittedAt: Not(IsNull()) },
        order: { submittedAt: 'DESC', id: 'DESC' },
        take: MAX_HISTORY,
      }),
    ]);
    return { draft, attempts };
  }

  async findById(id: number): Promise<ExerciseAttempt> {
    const attempt = await this.attempts.findOneBy({ id });
    if (!attempt) {
      throw new NotFoundException('Cette tentative n’existe pas.');
    }
    return attempt;
  }

  // Enregistre la réponse en cours de saisie ; elle remplace le brouillon précédent.
  async saveDraft(
    courseId: number,
    key: string,
    answer: unknown,
  ): Promise<ExerciseAttempt> {
    await this.checkTarget(courseId, key);
    const content = checkAnswer(answer);
    const draft =
      (await this.findDraft(courseId, key)) ??
      this.attempts.create({ courseId, exerciseKey: key, kind: 'exercise' });
    draft.answer = content;
    return this.attempts.save(draft);
  }

  // Valide une réponse : le brouillon d'un exercice devient une tentative ; un QCM
  // enregistre son score.
  async submit(
    courseId: number,
    key: string,
    input: SubmitAttemptDto,
  ): Promise<ExerciseAttempt> {
    await this.checkTarget(courseId, key);
    if (input.kind === 'quiz') {
      return this.submitQuiz(courseId, key, input);
    }
    const attempt =
      (await this.findDraft(courseId, key)) ??
      this.attempts.create({ courseId, exerciseKey: key, kind: 'exercise' });
    attempt.answer = checkAnswer(input.answer);
    attempt.submittedAt = new Date();
    return this.attempts.save(attempt);
  }

  // Note que l'on se donne après avoir lu le corrigé.
  async grade(id: number, input: GradeAttemptDto): Promise<ExerciseAttempt> {
    const attempt = await this.findById(id);
    if (attempt.kind !== 'exercise' || attempt.submittedAt === null) {
      throw new BadRequestException(
        'Seule une réponse validée à un exercice se note.',
      );
    }
    if (input.score !== null && !Number.isInteger(input.score * 2)) {
      throw new BadRequestException('La note se donne au demi-point.');
    }
    attempt.score = input.score;
    attempt.maxScore = input.score === null ? null : EXERCISE_MAX_SCORE;
    return this.attempts.save(attempt);
  }

  private submitQuiz(
    courseId: number,
    key: string,
    input: SubmitAttemptDto,
  ): Promise<ExerciseAttempt> {
    const score = input.score ?? 0;
    const maxScore = input.maxScore ?? 0;
    if (score > maxScore) {
      throw new BadRequestException(
        'Le score ne dépasse pas le nombre de questions.',
      );
    }
    return this.attempts.save(
      this.attempts.create({
        courseId,
        exerciseKey: key,
        kind: 'quiz',
        answer: null,
        score,
        maxScore,
        submittedAt: new Date(),
      }),
    );
  }

  private findDraft(
    courseId: number,
    key: string,
  ): Promise<ExerciseAttempt | null> {
    return this.attempts.findOneBy({
      courseId,
      exerciseKey: key,
      submittedAt: IsNull(),
    });
  }

  // Une clé mal formée ou un cours inconnu désignent un exercice qui n'existe pas.
  private async checkTarget(courseId: number, key: string): Promise<void> {
    if (
      !isExerciseKey(key) ||
      !(await this.courses.existsBy({ id: courseId }))
    ) {
      throw new NotFoundException('Cet exercice n’existe pas.');
    }
  }
}

// La réponse est un contenu comme celui d'un cours, traité comme hostile.
function checkAnswer(answer: unknown): ContentNode {
  const errors = validateContent(answer);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  if (JSON.stringify(answer).length > MAX_ANSWER_LENGTH) {
    throw new BadRequestException('La réponse est trop longue.');
  }
  return answer as ContentNode;
}
