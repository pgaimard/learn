import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContentNode } from '../courses/content/content-node.js';
import { Ue } from '../ue/ue.entity.js';

// Outil que l'on apprend à utiliser (bash, Cisco IOS, git) : sa fiche décrit son
// fonctionnement, ses modes et ses déclinaisons sont facultatifs.
@Entity('tools')
export class Tool {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'jsonb' })
  content!: ContentNode;

  @Column({ name: 'plain_text', type: 'text', select: false })
  plainText!: string;

  @OneToMany(() => ToolMode, (mode) => mode.tool, { cascade: true })
  modes!: ToolMode[];

  @OneToMany(() => ToolVariant, (variant) => variant.tool, { cascade: true })
  variants!: ToolVariant[];

  // UE où l'outil sert ; aucune pour un outil général.
  @ManyToMany(() => Ue)
  @JoinTable({
    name: 'tool_ues',
    joinColumn: { name: 'tool_id' },
    inverseJoinColumn: { name: 'ue_id' },
  })
  ues!: Ue[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// Mode d'un terminal (Cisco IOS : utilisateur, privilégié, configuration).
@Entity('tool_modes')
export class ToolMode {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  // Un mode retiré de la liste de son outil est supprimé avec elle.
  @ManyToOne(() => Tool, (tool) => tool.modes, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'tool_id' })
  tool?: Tool;

  @Column({ type: 'text' })
  name!: string;

  // Invite affichée par le terminal dans ce mode : « Router(config)# ».
  @Column({ type: 'text', default: '' })
  prompt!: string;

  // Façon d'entrer dans ce mode.
  @Column({ type: 'text', default: '' })
  entry!: string;

  @Column({ type: 'integer' })
  position!: number;
}

// Déclinaison d'un outil (bash et zsh pour « Shell Unix ») : une commande ou une option
// peut n'exister que dans certaines.
@Entity('tool_variants')
export class ToolVariant {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @ManyToOne(() => Tool, (tool) => tool.variants, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'tool_id' })
  tool?: Tool;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'integer' })
  position!: number;
}
