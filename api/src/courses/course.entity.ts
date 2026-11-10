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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
