import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ContentNode } from '../content/content-node.js';

// Ce qui a remplacé l'état gardé : l'IA, un paquet de cours, ou une restauration.
export const SNAPSHOT_ORIGINS = ['ai', 'package', 'restore'] as const;
export type SnapshotOrigin = (typeof SNAPSHOT_ORIGINS)[number];

@Entity('course_snapshots')
export class CourseSnapshot {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'course_id', type: 'integer' })
  courseId!: number;

  @Column({ type: 'text' })
  origin!: SnapshotOrigin;

  // Révision du cours au moment où l'instantané a été pris.
  @Column({ type: 'integer' })
  revision!: number;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'jsonb' })
  content!: ContentNode;

  @Column({ name: 'sheet_content', type: 'jsonb', nullable: true })
  sheetContent!: ContentNode | null;

  @Column({ name: 'exercises_content', type: 'jsonb', nullable: true })
  exercisesContent!: ContentNode | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
