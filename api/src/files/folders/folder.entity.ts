import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('folders')
export class Folder {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'ue_id', type: 'integer' })
  ueId!: number;

  // Absent pour un dossier placé à la racine de l'UE.
  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId!: number | null;

  @Column({ type: 'text' })
  name!: string;

  // Cours dont c'est le dossier : il suit alors son titre. Absent pour un dossier libre.
  @Column({ name: 'course_id', type: 'integer', nullable: true })
  courseId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
