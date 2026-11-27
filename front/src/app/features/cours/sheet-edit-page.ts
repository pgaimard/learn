import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { shortcut } from '../../core/ui/platform';
import { ContentNode } from './content/content-node';
import { Course, CourseService } from './course.service';
import { ContentEditor } from './editor/content-editor';

// Fiche qui n'est pas encore rédigée : une page blanche.
const BLANK: ContentNode = { type: 'doc', content: [{ type: 'paragraph' }] };

// Édition de la fiche de révision d'un cours : un document à part, écrit avec le même
// éditeur que le cours. Ses images sont des images du cours.
@Component({
  selector: 'app-sheet-edit-page',
  imports: [ContentEditor, Icon, RouterLink],
  templateUrl: './sheet-edit-page.html',
  styleUrl: './course-edit-page.css',
  host: {
    '(document:keydown.control.s)': 'saveFromKeyboard($event)',
    '(document:keydown.meta.s)': 'saveFromKeyboard($event)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetEditPage {
  // Paramètres de la route /ue/:code/cours/:id/fiche/edition.
  readonly code = input.required<string>();
  readonly id = input.required<string>();
  // Paramètre de requête ?bloc=n : rang du bloc où reprendre, venu de la lecture.
  readonly bloc = input<string>();

  private readonly courseService = inject(CourseService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly editor = viewChild(ContentEditor);

  protected readonly startBlock = computed(() => {
    const rank = Number(this.bloc());
    return this.bloc() !== undefined && Number.isInteger(rank) && rank >= 0 ? rank : null;
  });
  protected readonly course = signal<Course | null>(null);
  // Fiche chargée dans l'éditeur ; elle n'y est pas rechargée après un enregistrement,
  // ce qui déplacerait le curseur.
  protected readonly sheet = computed(() => this.course()?.sheetContent ?? BLANK);
  // Vrai quand la fiche existe en base : elle peut alors être supprimée.
  protected readonly isSaved = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly saveKey = shortcut('S');
  protected readonly isSaving = signal(false);
  protected readonly isDirty = signal(false);

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  // Appelé par la garde de sortie de la route.
  canLeave(): boolean | Promise<boolean> {
    return (
      !this.isDirty() ||
      this.dialog.confirm({
        title: 'Modifications non enregistrées',
        message: 'Quitter cette page fera perdre les modifications en cours.',
        confirmLabel: 'Quitter sans enregistrer',
        isDestructive: true,
      })
    );
  }

  protected markDirty(): void {
    this.isDirty.set(true);
  }

  protected save(): void {
    // Rien à enregistrer : le bouton est grisé, le raccourci clavier ne fait rien non plus.
    if (!this.isDirty()) {
      return;
    }
    const sheetContent = this.editor()?.getContent();
    if (this.isSaving() || !sheetContent) {
      return;
    }
    this.isSaving.set(true);
    this.errors.set([]);
    this.courseService.update(Number(this.id()), { sheetContent }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.isSaved.set(true);
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.errors.set(error.messages);
      },
    });
  }

  // Envoie une image collée, déposée ou choisie, puis l'insère à l'endroit du curseur.
  protected addImage(file: File): void {
    this.errors.set([]);
    this.courseService.uploadImage(Number(this.id()), file).subscribe({
      next: (image) => this.editor()?.insertFigure(image.src, image.altText),
      error: (error: ApiError) => {
        this.errors.set(error.messages);
        this.editor()?.imageFailed();
      },
    });
  }

  protected async remove(): Promise<void> {
    const course = this.course();
    if (
      !course ||
      !(await this.dialog.confirmDeletion(
        'Supprimer la fiche de révision',
        `La fiche de « ${course.title} » et ses images seront supprimées définitivement. Le cours n’est pas touché.`,
      ))
    ) {
      return;
    }
    this.courseService.update(course.id, { sheetContent: null }).subscribe({
      next: () => {
        this.isDirty.set(false);
        void this.router.navigate(['/ue', this.code(), 'cours', course.id]);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected saveFromKeyboard(event: Event): void {
    event.preventDefault();
    this.save();
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  private load(id: number): void {
    this.courseService.get(id).subscribe({
      next: (course) => {
        this.course.set(course);
        this.isSaved.set(course.sheetContent !== null);
        this.isDirty.set(false);
        this.title.setTitle(`Fiche – ${course.title}`);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
