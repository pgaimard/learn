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

export const EVENT_TYPES = ['course', 'deadline'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Événement de l'agenda : une séance de cours ou une échéance.
@Entity('events')
export class AgendaEvent {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'ue_id', type: 'integer', nullable: true })
  ueId!: number | null;

  @ManyToOne(() => Ue)
  @JoinColumn({ name: 'ue_id' })
  ue?: Ue | null;

  @Column({ type: 'text' })
  title!: string;

  // Vide pour un événement sans description.
  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'text' })
  type!: EventType;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  // Égale au début pour un événement ponctuel, comme une échéance.
  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
