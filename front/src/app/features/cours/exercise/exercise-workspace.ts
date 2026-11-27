import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DialogService } from '../../../core/dialog/dialog.service';
import { Icon } from '../../../core/ui/icon';
import { ContentNode } from '../content/content-node';
import { CourseContent } from '../content/course-content';
import { MentionTerm } from '../content/term-mentions';
import { ContentEditor } from '../editor/content-editor';
import { OpenedExercise } from './exercise';

const EMPTY_ANSWER: ContentNode = { type: 'doc', content: [{ type: 'paragraph' }] };

type Side = 'statement' | 'solution';

// Fenêtre où l'on fait un exercice : l'énoncé à gauche, la réponse à droite. Une fois la
// réponse validée, elle se fige et le corrigé s'affiche à côté d'elle.
@Component({
  selector: 'app-exercise-workspace',
  imports: [ContentEditor, CourseContent, Icon],
  templateUrl: './exercise-workspace.html',
  styleUrl: './exercise-workspace.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseWorkspace {
  readonly exercise = input.required<OpenedExercise>();
  // Termes à rendre cliquables dans l'énoncé et le corrigé.
  readonly terms = input<MentionTerm[]>([]);

  readonly closed = output();
  readonly termOpened = output<number>();

  private readonly dialogs = inject(DialogService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly editor = viewChild(ContentEditor);

  // Réponse en cours de saisie, puis figée à la validation.
  protected readonly answer = signal<ContentNode>(EMPTY_ANSWER);
  protected readonly isChecked = signal(false);
  protected readonly isDirty = signal(false);
  protected readonly message = signal('');
  // Ce que montre le volet de gauche ; le corrigé ne s'y affiche qu'après validation.
  protected readonly side = signal<Side>('statement');
  protected readonly shown = computed(() =>
    this.side() === 'solution' ? this.exercise().solution : this.exercise().statement,
  );

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected markDirty(): void {
    this.isDirty.set(true);
    this.message.set('');
  }

  // Une réponse se compose de texte, de tableaux, de grilles et de code.
  protected refuseImage(): void {
    this.message.set('Une réponse ne peut pas contenir d’image.');
    this.editor()?.imageFailed();
  }

  protected check(): void {
    this.answer.set(this.editor()?.getContent() ?? this.answer());
    this.isChecked.set(true);
    this.side.set('solution');
  }

  // Reprend la réponse validée pour la corriger ; le corrigé se cache de nouveau.
  protected retry(): void {
    this.isChecked.set(false);
    this.side.set('statement');
  }

  // Fermer avant d'avoir validé perdrait la réponse saisie : on le fait confirmer.
  protected async close(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.isDirty() && !this.isChecked()) {
      const isConfirmed = await this.dialogs.confirm({
        title: 'Fermer l’exercice ?',
        message: 'Votre réponse n’est pas enregistrée : elle sera perdue.',
        confirmLabel: 'Fermer',
        isDestructive: true,
      });
      if (!isConfirmed) {
        return;
      }
    }
    this.closed.emit();
  }
}
