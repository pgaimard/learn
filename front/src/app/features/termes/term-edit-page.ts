import { DatePipe } from '@angular/common';
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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { MenuButton } from '../../core/ui/menu-button';
import { shortcut } from '../../core/ui/platform';
import { Dropdown } from '../../core/ui/dropdown';
import { ContentEditor } from '../cours/editor/content-editor';
import { ueOptions } from '../ue/ue-options';
import { Ue, UeService } from '../ue/ue.service';
import { TERM_SCREENS } from './term-screens';
import { Term, TermInput, TermService } from './term.service';

@Component({
  selector: 'app-term-edit-page',
  imports: [Icon, MenuButton, Dropdown, ContentEditor, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './term-edit-page.html',
  styleUrl: './term-edit-page.css',
  host: {
    '(document:keydown.control.s)': 'saveFromKeyboard($event)',
    '(document:keydown.meta.s)': 'saveFromKeyboard($event)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermEditPage {
  // Paramètre de la route /dictionnaire/:id/edition ou /glossaire/:id/edition.
  readonly id = input.required<string>();

  private readonly termService = inject(TermService);
  private readonly dialog = inject(DialogService);
  private readonly ueService = inject(UeService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly editor = viewChild(ContentEditor);

  protected readonly term = signal<Term | null>(null);
  protected readonly ues = signal<Ue[]>([]);
  protected readonly ueChoices = computed(() =>
    ueOptions(this.ues(), [{ value: '', label: 'Aucune' }]),
  );
  // Origine telle qu'enregistrée : elle sert à savoir si l'UE choisie a changé.
  protected readonly origin = signal<Pick<Term, 'ue' | 'course'>>({ ue: null, course: null });
  protected readonly screen = computed(() => TERM_SCREENS[this.term()?.type ?? 'definition']);
  protected readonly errors = signal<string[]>([]);
  protected readonly saveKey = shortcut('S');
  protected readonly isSaving = signal(false);
  protected readonly isDirty = signal(false);
  protected readonly savedAt = signal<Date | null>(null);

  protected readonly form = this.formBuilder.group({
    label: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    expandedForm: ['', Validators.maxLength(300)],
    ueCode: [''],
  });

  constructor() {
    effect(() => this.load(Number(this.id())));
    this.ueService.list().subscribe({
      next: (ues) => this.ues.set(ues),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
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

  protected isExpandedFormInvalid(): boolean {
    const control = this.form.controls.expandedForm;
    return control.touched && (control.invalid || control.value.trim().length === 0);
  }

  protected save(): void {
    const term = this.term();
    const content = this.editor()?.getContent();
    if (!term || !content || this.isSaving() || !this.isFormValid(term)) {
      this.form.markAllAsTouched();
      return;
    }
    const { label, expandedForm } = this.form.getRawValue();
    const changes: TermInput = {
      label: label.trim(),
      ...(term.type === 'acronym' ? { expandedForm: expandedForm.trim() } : {}),
      content,
      ...this.originChanges(),
    };
    this.isSaving.set(true);
    this.errors.set([]);
    this.termService.update(term.id, changes).subscribe({
      next: (saved) => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.savedAt.set(new Date());
        this.origin.set({ ue: saved.ue, course: saved.course });
        this.title.setTitle(`Édition – ${saved.label}`);
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
    this.termService.uploadImage(Number(this.id()), file).subscribe({
      next: (image) => this.editor()?.insertFigure(image.src, image.altText),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected async remove(): Promise<void> {
    const term = this.term();
    if (
      !term ||
      !(await this.dialog.confirmDeletion(
        'Supprimer le terme',
        `« ${term.label} » et sa définition seront supprimés définitivement.`,
      ))
    ) {
      return;
    }
    this.termService.remove(term.id).subscribe({
      next: () => {
        this.isDirty.set(false);
        void this.router.navigate([this.screen().path]);
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

  private isFormValid(term: Term): boolean {
    const { expandedForm } = this.form.getRawValue();
    return this.form.valid && (term.type !== 'acronym' || expandedForm.trim().length > 0);
  }

  // Un cours d'origine impose son UE : changer d'UE détache donc le terme de ce cours.
  private originChanges(): TermInput {
    const ueCode = this.form.controls.ueCode.value;
    if (ueCode === (this.origin().ue?.code ?? '')) {
      return {};
    }
    return { ueCode: ueCode === '' ? null : ueCode, courseId: null };
  }

  private load(id: number): void {
    this.termService.get(id).subscribe({
      next: (term) => {
        this.term.set(term);
        this.origin.set({ ue: term.ue, course: term.course });
        this.form.setValue({
          label: term.label,
          expandedForm: term.expandedForm ?? '',
          ueCode: term.ue?.code ?? '',
        });
        this.isDirty.set(false);
        this.title.setTitle(`Édition – ${term.label}`);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
