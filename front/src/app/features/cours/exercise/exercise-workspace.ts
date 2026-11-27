import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Icon } from '../../../core/ui/icon';
import { ContentNode } from '../content/content-node';
import { CourseContent } from '../content/course-content';
import { MentionTerm } from '../content/term-mentions';
import { ContentEditor } from '../editor/content-editor';
import { OpenedExercise } from './exercise';
import {
  Attempt,
  AttemptSummary,
  ExerciseAttemptsService,
  isQuizAnswers,
} from './exercise-attempts.service';

const EMPTY_ANSWER: ContentNode = { type: 'doc', content: [{ type: 'paragraph' }] };
// Délai sans frappe après lequel le brouillon part à l'enregistrement.
const DRAFT_DELAY_MS = 1200;
const MAX_SCORE = 20;

type Side = 'statement' | 'solution';
type DraftState = 'idle' | 'pending' | 'saved' | 'failed';

// Fenêtre où l'on fait un exercice : l'énoncé à gauche, la réponse à droite. Le brouillon
// s'enregistre au fil de la saisie. Une fois la réponse validée, elle se fige, le corrigé
// s'affiche à côté d'elle et on se donne une note ; les tentatives restent dans l'historique.
@Component({
  selector: 'app-exercise-workspace',
  imports: [ContentEditor, CourseContent, DatePipe, Icon],
  templateUrl: './exercise-workspace.html',
  styleUrl: './exercise-workspace.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseWorkspace {
  readonly courseId = input.required<number>();
  readonly exercise = input.required<OpenedExercise>();
  // Termes à rendre cliquables dans l'énoncé et le corrigé.
  readonly terms = input<MentionTerm[]>([]);

  readonly closed = output();
  readonly termOpened = output<number>();

  private readonly attemptsService = inject(ExerciseAttemptsService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly editor = viewChild(ContentEditor);

  protected readonly maxScore = MAX_SCORE;
  // Le brouillon et l'historique sont lus avant d'ouvrir l'éditeur.
  protected readonly isReady = signal(false);
  // Réponse en cours de saisie.
  protected readonly answer = signal<ContentNode>(EMPTY_ANSWER);
  protected readonly draftState = signal<DraftState>('idle');
  // Tentative affichée à la place de l'éditeur : celle qu'on vient de valider, ou une
  // ancienne ouverte depuis l'historique.
  protected readonly shownAttempt = signal<Attempt | null>(null);
  protected readonly attempts = signal<AttemptSummary[]>([]);
  protected readonly isHistoryOpen = signal(false);
  protected readonly message = signal('');
  // Ce que montre le volet de gauche ; le corrigé ne s'y affiche qu'avec une tentative.
  protected readonly side = signal<Side>('statement');
  protected readonly shown = computed(() =>
    this.side() === 'solution' ? this.exercise().solution : this.exercise().statement,
  );
  protected readonly draftLabel = computed(() => DRAFT_LABELS[this.draftState()]);

  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      void this.load();
    });
    inject(DestroyRef).onDestroy(() => this.cancelTimer());
  }

  // Réponse rédigée de la tentative affichée.
  protected readonly shownAnswer = computed(() => writtenAnswer(this.shownAttempt()));

  // Note à la française : 14,5 et non 14.5.
  protected scoreLabel(score: number): string {
    return String(score).replace('.', ',');
  }

  protected markDirty(): void {
    this.message.set('');
    this.draftState.set('pending');
    this.cancelTimer();
    this.draftTimer = setTimeout(() => void this.saveDraft(), DRAFT_DELAY_MS);
  }

  // Une réponse se compose de texte, de tableaux, de grilles et de code.
  protected refuseImage(): void {
    this.message.set('Une réponse ne peut pas contenir d’image.');
    this.editor()?.imageFailed();
  }

  // Valide la réponse : elle se fige, entre dans l'historique, et le corrigé s'affiche.
  protected async check(): Promise<void> {
    this.cancelTimer();
    const answer = this.editor()?.getContent() ?? this.answer();
    try {
      const attempt = await firstValueFrom(
        this.attemptsService.submitExercise(this.courseId(), this.exercise().key, answer),
      );
      this.answer.set(EMPTY_ANSWER);
      this.draftState.set('idle');
      this.show(attempt);
      await this.refreshHistory();
    } catch {
      this.message.set('La réponse n’a pas pu être enregistrée. Réessayez.');
    }
  }

  // Enregistre la note qu'on se donne, sur 20 et au demi-point ; vide, elle est retirée.
  protected async grade(value: string): Promise<void> {
    const attempt = this.shownAttempt();
    const score = value.trim() === '' ? null : Number(value.replace(',', '.'));
    if (!attempt) {
      return;
    }
    if (score !== null && !isValidScore(score)) {
      this.message.set(`La note va de 0 à ${MAX_SCORE}, au demi-point.`);
      return;
    }
    try {
      this.shownAttempt.set(await firstValueFrom(this.attemptsService.grade(attempt.id, score)));
      this.message.set('');
      await this.refreshHistory();
    } catch {
      this.message.set('La note n’a pas pu être enregistrée. Réessayez.');
    }
  }

  // Repart de la réponse affichée pour en rédiger une nouvelle ; le corrigé se cache.
  protected retry(): void {
    this.answer.set(writtenAnswer(this.shownAttempt()) ?? EMPTY_ANSWER);
    this.shownAttempt.set(null);
    this.side.set('statement');
    this.message.set('');
  }

  protected async open(summary: AttemptSummary): Promise<void> {
    this.isHistoryOpen.set(false);
    await this.flushDraft();
    try {
      this.show(await firstValueFrom(this.attemptsService.find(summary.id)));
    } catch {
      this.message.set('Cette tentative n’a pas pu être lue.');
    }
  }

  // Le brouillon part avant la fermeture : rien de ce qui est saisi ne se perd.
  protected async close(event?: Event): Promise<void> {
    event?.preventDefault();
    await this.flushDraft();
    this.closed.emit();
  }

  private show(attempt: Attempt): void {
    this.shownAttempt.set(attempt);
    this.side.set('solution');
    this.message.set('');
  }

  private async load(): Promise<void> {
    try {
      const progress = await firstValueFrom(
        this.attemptsService.progress(this.courseId(), this.exercise().key),
      );
      this.answer.set(writtenAnswer(progress.draft) ?? EMPTY_ANSWER);
      this.attempts.set(progress.attempts);
    } catch {
      this.message.set('Vos réponses précédentes n’ont pas pu être lues.');
    }
    this.isReady.set(true);
  }

  private async refreshHistory(): Promise<void> {
    const progress = await firstValueFrom(
      this.attemptsService.progress(this.courseId(), this.exercise().key),
    );
    this.attempts.set(progress.attempts);
  }

  private async flushDraft(): Promise<void> {
    if (this.draftState() === 'pending') {
      this.cancelTimer();
      await this.saveDraft();
    }
  }

  private async saveDraft(): Promise<void> {
    this.draftTimer = null;
    const editor = this.editor();
    if (!editor) {
      return;
    }
    const answer = editor.getContent();
    try {
      await firstValueFrom(
        this.attemptsService.saveDraft(this.courseId(), this.exercise().key, answer),
      );
      this.answer.set(answer);
      // Une frappe pendant l'envoi a relancé l'attente : elle garde la main.
      if (this.draftTimer === null) {
        this.draftState.set('saved');
      }
    } catch {
      this.draftState.set('failed');
    }
  }

  private cancelTimer(): void {
    if (this.draftTimer !== null) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
  }
}

const DRAFT_LABELS: Record<DraftState, string> = {
  idle: '',
  pending: 'Enregistrement…',
  saved: 'Brouillon enregistré',
  failed: 'Brouillon non enregistré',
};

// Réponse rédigée d'une tentative d'exercice ; les cases d'un QCM n'en sont pas une.
function writtenAnswer(attempt: Attempt | null): ContentNode | null {
  const answer = attempt?.answer ?? null;
  return isQuizAnswers(answer) ? null : answer;
}

function isValidScore(score: number): boolean {
  return Number.isFinite(score) && score >= 0 && score <= MAX_SCORE && Number.isInteger(score * 2);
}
