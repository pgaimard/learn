import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContentNode } from '../courses/content/content-node.js';
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';

export const TERM_TYPES = ['definition', 'acronym'] as const;
export type TermType = (typeof TERM_TYPES)[number];

@Entity('terms')
export class Term {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ type: 'text' })
  type!: TermType;

  @Column({ type: 'text' })
  label!: string;

  @Column({ name: 'expanded_form', type: 'text', nullable: true })
  expandedForm!: string | null;

  @Column({ type: 'jsonb' })
  content!: ContentNode;

  @Column({ name: 'plain_text', type: 'text', select: false })
  plainText!: string;

  @Column({ name: 'ue_id', type: 'integer', nullable: true })
  ueId!: number | null;

  @ManyToOne(() => Ue)
  @JoinColumn({ name: 'ue_id' })
  ue?: Ue | null;

  @Column({ name: 'course_id', type: 'integer', nullable: true })
  courseId!: number | null;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course?: Pick<Course, 'id' | 'title'> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
