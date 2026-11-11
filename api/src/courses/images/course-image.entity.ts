import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('course_images')
export class CourseImage {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'course_id', type: 'integer' })
  courseId!: number;

  // Nom du fichier sur disque : généré par l'API, jamais fourni par le client.
  @Column({ name: 'storage_name', type: 'text', unique: true })
  storageName!: string;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ type: 'integer' })
  size!: number;

  @Column({ name: 'alt_text', type: 'text', default: '' })
  altText!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
