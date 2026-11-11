import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Fichier déposé dans une UE. Son contenu est sur disque ; « StoredFile » évite la
// confusion avec le type File de la plateforme.
@Entity('files')
export class StoredFile {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @Column({ name: 'ue_id', type: 'integer' })
  ueId!: number;

  // Absent pour un fichier placé à la racine de l'UE.
  @Column({ name: 'folder_id', type: 'integer', nullable: true })
  folderId!: number | null;

  @Column({ type: 'text' })
  name!: string;

  // Nom du fichier sur disque : généré par l'API, jamais fourni par le client.
  @Column({ name: 'storage_name', type: 'text', unique: true, select: false })
  storageName!: string;

  // Type annoncé à l'envoi, gardé pour information : il ne sert jamais à servir le fichier.
  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ type: 'integer' })
  size!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
