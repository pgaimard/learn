import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { filterTerms } from './filter-terms';
import { TermDetail } from './term-detail';
import { TermForm } from './term-form';
import { ALPHABET, letterOf } from './term-letters';
import { TermList } from './term-list';
import { TERM_SCREENS } from './term-screens';
import { Term, TermInput, TermService, TermSummary, TermType } from './term.service';

@Component({
  selector: 'app-term-list-page',
  imports: [Icon, Modal, RouterLink, TermDetail, TermForm, TermList],
  templateUrl: './term-list-page.html',
  styleUrl: './term-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermListPage {
  // Donnée de la route : le dictionnaire liste les définitions, le glossaire les acronymes.
  readonly type = input.required<TermType>();
  // Paramètre de la route /dictionnaire/:id : la définition affichée à côté de la liste.
  readonly id = input<string>();

  private readonly termService = inject(TermService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly screen = computed(() => TERM_SCREENS[this.type()]);
  protected readonly terms = signal<TermSummary[]>([]);
  protected readonly filter = signal('');
  // Glossaire : '' pour toutes les UE, sinon le code de l'UE retenue.
  protected readonly ueFilter = signal('');
  protected readonly visibleTerms = computed(() => {
    const ue = this.ueFilter();
    return filterTerms(this.terms(), this.filter()).filter(
      (term) => ue === '' || term.ueCode === ue,
    );
  });
  protected readonly isDictionary = computed(() => this.type() === 'definition');
  // UE qui ont au moins un terme, pour les pastilles de filtre.
  protected readonly ueCodes = computed(() =>
    [...new Set(this.terms().flatMap((term) => (term.ueCode ? [term.ueCode] : [])))].sort(),
  );
  protected readonly alphabet = ALPHABET;
  protected readonly usedLetters = computed(
    () => new Set(this.visibleTerms().map((term) => letterOf(term.label))),
  );
  // Dictionnaire : la définition de l'adresse, sinon la première de la liste.
  protected readonly selectedId = computed(() => {
    const id = Number(this.id());
    return Number.isInteger(id) && id > 0 ? id : (this.visibleTerms().at(0)?.id ?? null);
  });
  protected readonly selected = signal<Term | null>(null);
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
    effect(() => {
      const id = this.isDictionary() ? this.selectedId() : null;
      this.selected.set(null);
      if (id !== null) {
        this.termService.get(id).subscribe({
          next: (term) => this.selected.set(term),
          error: (error: ApiError) => this.pageErrors.set(error.messages),
        });
      }
    });
  }

  protected goToLetter(letter: string): void {
    this.host.nativeElement
      .querySelector(`#lettre-${letter}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  protected async remove(term: Pick<TermSummary, 'id' | 'label'>): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer le terme',
      `« ${term.label} » et sa définition seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.termService.remove(term.id).subscribe({
      next: () => {
        // La définition supprimée n'est plus à afficher : retour à la liste.
        if (this.id() !== undefined) {
          void this.router.navigateByUrl(this.screen().path);
        }
        this.load(this.type());
      },
      error: (error: ApiError) => this.pageErrors.set(error.messages),
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
