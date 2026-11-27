import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ue } from '../ue/ue.entity.js';
import type { ContentNode } from './content/content-node.js';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'ue_id', type: 'integer' })
  ueId!: number;

  @ManyToOne(() => Ue)
  @JoinColumn({ name: 'ue_id' })
  ue?: Ue;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ type: 'jsonb' })
  content!: ContentNode;

  @Column({ name: 'plain_text', type: 'text', select: false })
  plainText!: string;

  // Fiche de révision rédigée, au même format que le cours ; null quand il n'en a pas.
  // Ses images sont des images du cours.
  @Column({ name: 'sheet_content', type: 'jsonb', nullable: true })
  sheetContent!: ContentNode | null;

  // Exercices du cours, au même format ; null quand il n'en a pas. C'est le seul document
  // où se placent les QCM et les exercices. Ses images sont des images du cours.
  @Column({ name: 'exercises_content', type: 'jsonb', nullable: true })
  exercisesContent!: ContentNode | null;

  // Marque-page de lecture : le titre où l'on s'est arrêté et le rang de son bloc ;
  // tous deux null quand le cours n'en a pas.
  @Column({ name: 'bookmark_title', type: 'text', nullable: true })
  bookmarkTitle!: string | null;

  @Column({ name: 'bookmark_block', type: 'integer', nullable: true })
  bookmarkBlock!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
