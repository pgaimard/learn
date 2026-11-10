import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { CourseService, CourseSummary } from '../cours/course.service';
import { Ue, UeService } from './ue.service';

@Component({
  selector: 'app-ue-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './ue-page.html',
  styleUrl: './ue-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UePage {
  // Paramètre de la route /ue/:code.
  readonly code = input.required<string>();

  private readonly ueService = inject(UeService);
  private readonly courseService = inject(CourseService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly ue = signal<Ue | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly pageErrors = signal<string[]>([]);
  protected readonly isCreating = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formErrors = signal<string[]>([]);

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    position: this.formBuilder.control<number | null>(null, Validators.min(0)),
  });

  constructor() {
    effect(() => this.load(this.code()));
  }

  protected openForm(): void {
    this.form.reset();
    this.formErrors.set([]);
    this.isCreating.set(true);
  }

  protected closeForm(): void {
    this.isCreating.set(false);
  }

  protected createCourse(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, position } = this.form.getRawValue();
    this.isSaving.set(true);
    this.courseService
      .create(this.code(), { title: title.trim(), ...(position === null ? {} : { position }) })
      .subscribe({
        next: (course) => void this.router.navigate(['/ue', this.code(), 'cours', course.id]),
        error: (error: ApiError) => {
          this.isSaving.set(false);
          this.formErrors.set(error.messages);
        },
      });
  }

  private load(code: string): void {
    forkJoin({ ue: this.ueService.get(code), courses: this.courseService.list(code) }).subscribe({
      next: ({ ue, courses }) => {
        this.ue.set(ue);
        this.courses.set(courses);
        this.title.setTitle(`${ue.code} – ${ue.title}`);
      },
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }
}
