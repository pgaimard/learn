import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ApiError } from '../../core/http/api-error';
import { filterTerms } from './filter-terms';
import { TermForm } from './term-form';
import { TermList } from './term-list';
import { TERM_SCREENS } from './term-screens';
import { TermInput, TermService, TermSummary, TermType } from './term.service';

@Component({
  selector: 'app-term-list-page',
  imports: [TermForm, TermList],
  templateUrl: './term-list-page.html',
  styleUrl: './term-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermListPage {
  // Donnée de la route : le dictionnaire liste les définitions, le glossaire les acronymes.
  readonly type = input.required<TermType>();

  private readonly termService = inject(TermService);

  protected readonly screen = computed(() => TERM_SCREENS[this.type()]);
  protected readonly terms = signal<TermSummary[]>([]);
  protected readonly filter = signal('');
  protected readonly visibleTerms = computed(() => filterTerms(this.terms(), this.filter()));
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  protected readonly isCreating = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  constructor() {
    // La liste se recharge aussi après une création faite ailleurs (création rapide).
    effect(() => {
      this.termService.revision();
      this.load(this.type());
    });
  }

  protected openForm(): void {
    this.formErrors.set([]);
    this.isCreating.set(true);
  }

  protected closeForm(): void {
    this.isCreating.set(false);
  }

  protected create(input: TermInput): void {
    if (this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.termService.create(input).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeForm();
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.formErrors.set(error.messages);
      },
    });
  }

  private load(type: TermType): void {
    this.termService.list({ type }).subscribe({
      next: (terms) => {
        this.terms.set(terms);
        this.pageErrors.set([]);
        this.isLoading.set(false);
      },
      error: (error: ApiError) => {
        this.pageErrors.set(error.messages);
        this.isLoading.set(false);
      },
    });
  }
}
