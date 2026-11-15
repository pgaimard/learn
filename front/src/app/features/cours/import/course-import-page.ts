import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommandImportSummary } from '../../outils/command-import-summary';
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
  imports: [CommandImportSummary, ReactiveFormsModule, RouterLink],
  templateUrl: './course-import-page.html',
  styleUrl: './course-import-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseImportPage {
  private readonly importService = inject(CourseImportService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('package');
  protected readonly markdown = new FormControl('', { nonNullable: true });
  // Remplacer la définition des termes déjà présents par celle du paquet.
  protected readonly replaceTerms = new FormControl(false, { nonNullable: true });
  // Remplacer les commandes déjà présentes par celles du paquet.
  protected readonly replaceCommands = signal(false);
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
    const replaceTerms = preview.duplicateTerms.length > 0 && this.replaceTerms.value;
    const replaceCommands = preview.commands.duplicateCommands.length > 0 && this.replaceCommands();
    this.importService
      .import(source, preview.existingCourse !== null, replaceTerms, replaceCommands)
      .subscribe({
        next: (course) => void this.router.navigate(['/ue', course.ue.code, 'cours', course.id]),
        error: (error: ApiError) => this.fail(error),
      });
  }

  protected reset(): void {
    this.source.set(null);
    this.preview.set(null);
    this.errors.set([]);
    this.replaceTerms.reset();
    this.replaceCommands.set(false);
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
