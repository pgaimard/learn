import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { CourseService, CourseSummary } from '../cours/course.service';
import { FileBrowser } from '../fichiers/file-browser';
import { TermList } from '../termes/term-list';
import { TermService, TermSummary } from '../termes/term.service';
import { Ue, UeService } from './ue.service';

@Component({
  selector: 'app-ue-page',
  imports: [DatePipe, FileBrowser, ReactiveFormsModule, RouterLink, TermList],
  templateUrl: './ue-page.html',
  styleUrl: './ue-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UePage {
  // Paramètre de la route /ue/:code.
  readonly code = input.required<string>();
  // Paramètre de requête ?onglet=termes ou ?onglet=fichiers ; l'onglet des cours est celui par défaut.
  readonly onglet = input<string>();
  // Paramètre de requête ?dossier=12 : dossier affiché dans l'onglet des fichiers.
  readonly dossier = input<string>();

  private readonly ueService = inject(UeService);
  private readonly courseService = inject(CourseService);
  private readonly termService = inject(TermService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly ue = signal<Ue | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly terms = signal<TermSummary[]>([]);
  protected readonly tab = computed(() => {
    const tab = this.onglet();
    return tab === 'termes' || tab === 'fichiers' ? tab : 'cours';
  });
  protected readonly folderId = computed(() => {
    const id = Number(this.dossier());
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly pageErrors = signal<string[]>([]);
  protected readonly isCreating = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formErrors = signal<string[]>([]);

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    position: this.formBuilder.control<number | null>(null, Validators.min(0)),
  });

  constructor() {
    // Se recharge aussi quand un terme vient d'être créé (création rapide).
    effect(() => {
      this.termService.revision();
      this.load(this.code());
    });
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
        next: (course) =>
          void this.router.navigate(['/ue', this.code(), 'cours', course.id, 'edition']),
        error: (error: ApiError) => {
          this.isSaving.set(false);
          this.formErrors.set(error.messages);
        },
      });
  }

  protected async removeTerm(term: TermSummary): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer le terme',
      `« ${term.label} » et sa définition seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.termService.remove(term.id).subscribe({
      next: () => this.load(this.code()),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  private load(code: string): void {
    forkJoin({
      ue: this.ueService.get(code),
      courses: this.courseService.list(code),
      terms: this.termService.list({ ue: code }),
    }).subscribe({
      next: ({ ue, courses, terms }) => {
        this.ue.set(ue);
        this.courses.set(courses);
        this.terms.set(terms);
        this.title.setTitle(`${ue.code} – ${ue.title}`);
      },
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }
}
