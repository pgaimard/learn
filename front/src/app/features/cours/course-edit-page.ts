import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Course, CourseService } from './course.service';
import { ContentEditor } from './editor/content-editor';

@Component({
  selector: 'app-course-edit-page',
  imports: [ContentEditor, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './course-edit-page.html',
  styleUrl: './course-edit-page.css',
  host: {
    '(document:keydown.control.s)': 'saveFromKeyboard($event)',
    '(document:keydown.meta.s)': 'saveFromKeyboard($event)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseEditPage {
  // Paramètres de la route /ue/:code/cours/:id/edition.
  readonly code = input.required<string>();
  readonly id = input.required<string>();

  private readonly courseService = inject(CourseService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly editor = viewChild(ContentEditor);

  protected readonly course = signal<Course | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly isDirty = signal(false);
  protected readonly savedAt = signal<Date | null>(null);

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
  });

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
    const content = this.editor()?.getContent();
    if (this.form.invalid || this.isSaving() || !content) {
      this.form.markAllAsTouched();
      return;
    }
    const { title } = this.form.getRawValue();
    this.isSaving.set(true);
    this.errors.set([]);
    this.courseService.update(Number(this.id()), { title: title.trim(), content }).subscribe({
      next: (course) => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.savedAt.set(new Date());
        this.title.setTitle(`Édition – ${course.title}`);
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
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected async remove(): Promise<void> {
    const course = this.course();
    if (
      !course ||
      !(await this.dialog.confirmDeletion(
        'Supprimer le cours',
        `Le cours « ${course.title} » et ses images seront supprimés définitivement.`,
      ))
    ) {
      return;
    }
    this.courseService.remove(course.id).subscribe({
      next: () => {
        this.isDirty.set(false);
        void this.router.navigate(['/ue', this.code()]);
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
        this.form.setValue({ title: course.title });
        this.isDirty.set(false);
        this.title.setTitle(`Édition – ${course.title}`);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
