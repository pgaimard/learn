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

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'ue_id', type: 'integer', nullable: true })
  ueId!: number | null;

  @ManyToOne(() => Ue)
  @JoinColumn({ name: 'ue_id' })
  ue?: Ue | null;

  @Column({ type: 'text' })
  title!: string;

  // Échéance, facultative.
  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  // Moment à partir duquel la tâche est rappelée dans l'application.
  @Column({ name: 'remind_at', type: 'timestamptz', nullable: true })
  remindAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  done!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
