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
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';
import { Tool, ToolMode, ToolVariant } from './tool.entity.js';

// Commande apprise d'un outil. La même commande existe autant de fois qu'il y a
// d'outils où elle sert : son nom n'est unique que dans son outil.
@Entity('commands')
export class Command {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool!: Tool;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'text', default: '' })
  syntax!: string;

  // Mode de l'outil où la commande se tape ; aucun quand l'outil n'a pas de mode.
  @ManyToOne(() => ToolMode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mode_id' })
  mode!: ToolMode | null;

  // Déclinaisons de l'outil où la commande existe ; aucune : elle vaut pour toutes.
  @ManyToMany(() => ToolVariant)
  @JoinTable({
    name: 'command_variants',
    joinColumn: { name: 'command_id' },
    inverseJoinColumn: { name: 'variant_id' },
  })
  variants!: ToolVariant[];

  @Column({ type: 'text', default: '' })
  notes!: string;

  // Texte cherché par la recherche globale, dérivé à chaque enregistrement.
  @Column({ name: 'plain_text', type: 'text', default: '', select: false })
  plainText!: string;

  // Étiquettes libres : « réseau », « fichiers ».
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  themes!: string[];

  // UE où la commande sert.
  @ManyToMany(() => Ue)
  @JoinTable({
    name: 'command_ues',
    joinColumn: { name: 'command_id' },
    inverseJoinColumn: { name: 'ue_id' },
  })
  ues!: Ue[];

  // Cours où la commande sert. Jamais chargés avec la commande, pour ne pas ramener
  // leur contenu : le service lit leurs titres à part.
  @ManyToMany(() => Course)
  @JoinTable({
    name: 'command_courses',
    joinColumn: { name: 'command_id' },
    inverseJoinColumn: { name: 'course_id' },
  })
  courses?: Course[];

  @OneToMany(() => CommandOption, (option) => option.command, {
    cascade: true,
  })
  options!: CommandOption[];

  @OneToMany(() => CommandExample, (example) => example.command, {
    cascade: true,
  })
  examples!: CommandExample[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('command_options')
export class CommandOption {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  // Une option retirée de la liste de sa commande est supprimée avec elle.
  @ManyToOne(() => Command, (command) => command.options, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'command_id' })
  command?: Command;

  // L'option telle qu'on la tape : « -c <nombre> ».
  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  // Déclinaisons où l'option existe ; aucune : elle vaut pour toutes.
  @ManyToMany(() => ToolVariant)
  @JoinTable({
    name: 'command_option_variants',
    joinColumn: { name: 'option_id' },
    inverseJoinColumn: { name: 'variant_id' },
  })
  variants!: ToolVariant[];

  @Column({ type: 'integer' })
  position!: number;
}

@Entity('command_examples')
export class CommandExample {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id!: number;

  @ManyToOne(() => Command, (command) => command.examples, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'command_id' })
  command?: Command;

  @Column({ type: 'text' })
  line!: string;

  @Column({ type: 'text', default: '' })
  explanation!: string;

  // Ce que le terminal répond ; vide quand l'exemple n'en montre rien.
  @Column({ type: 'text', default: '' })
  output!: string;

  @Column({ type: 'integer' })
  position!: number;
}
