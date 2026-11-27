import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Jeton que le connecteur de Claude envoie au serveur MCP. Un seul à la fois.
@Entity('ai_access_tokens')
export class AiAccessToken {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  // Empreinte SHA-256 du jeton : le jeton lui-même n'est jamais enregistré.
  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;
}
