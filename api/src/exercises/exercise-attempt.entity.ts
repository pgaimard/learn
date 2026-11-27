import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentNode } from '../courses/content/content-node.js';

export type AttemptKind = 'exercise' | 'quiz';

// PostgreSQL rend un numeric en texte : la note redevient un nombre.
const numeric = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

// Réponse donnée à un exercice ou à un QCM d'un cours. Sans date de validation, c'est le
// brouillon en cours de l'exercice.
@Entity('exercise_attempts')
export class ExerciseAttempt {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'course_id', type: 'integer' })
  courseId!: number;

  // Clé de l'exercice ou du QCM dans le cours.
  @Column({ name: 'exercise_key', type: 'text' })
  exerciseKey!: string;

  @Column({ type: 'text' })
  kind!: AttemptKind;

  // Réponse rédigée d'un exercice ; un QCM n'en a pas.
  @Column({ type: 'jsonb', nullable: true })
  answer!: ContentNode | null;

  // Note donnée (exercice) ou nombre de bonnes réponses (QCM), sur maxScore.
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numeric,
  })
  score!: number | null;

  @Column({
    name: 'max_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numeric,
  })
  maxScore!: number | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
