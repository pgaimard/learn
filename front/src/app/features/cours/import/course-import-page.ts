import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import {
  CourseImportService,
  ImportedTerm,
  ImportPreview,
  ImportSource,
} from './course-import.service';

type Mode = 'package' | 'markdown';

@Component({
  selector: 'app-course-import-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './course-import-page.html',
  styleUrl: './course-import-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseImportPage {
  private readonly importService = inject(CourseImportService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('package');
  protected readonly markdown = new FormControl('', { nonNullable: true });
  // Source analysée avec succès, en attente de confirmation.
  protected readonly source = signal<ImportSource | null>(null);
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly isBusy = signal(false);

  protected labelsOf(terms: ImportedTerm[]): string {
    return terms.map((term) => term.label).join(', ');
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.reset();
  }

  protected pickPackage(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.item(0);
    field.value = '';
    if (file) {
      this.analyse({ kind: 'package', file });
    }
  }

  protected analyseMarkdown(): void {
    const markdown = this.markdown.value;
    if (markdown.trim().length > 0) {
      this.analyse({ kind: 'markdown', markdown });
    }
  }

  protected confirm(): void {
    const source = this.source();
    const preview = this.preview();
    if (!source || !preview || this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    this.importService.import(source, preview.existingCourse !== null).subscribe({
      next: (course) => void this.router.navigate(['/ue', course.ue.code, 'cours', course.id]),
      error: (error: ApiError) => this.fail(error),
    });
  }

  protected reset(): void {
    this.source.set(null);
    this.preview.set(null);
    this.errors.set([]);
  }

  private analyse(source: ImportSource): void {
    this.reset();
    this.isBusy.set(true);
    this.importService.preview(source).subscribe({
      next: (preview) => {
        this.source.set(source);
        this.preview.set(preview);
        this.isBusy.set(false);
      },
      error: (error: ApiError) => this.fail(error),
    });
  }

  private fail(error: ApiError): void {
    this.errors.set(error.messages);
    this.isBusy.set(false);
  }
}
