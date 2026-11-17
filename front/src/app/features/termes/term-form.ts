import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentNode } from '../cours/content/content-node';
import { Segmented, SegmentedOption } from '../../core/ui/segmented';
import { TermInput, TermType } from './term.service';

// Création rapide d'un terme : la définition saisie ici est un simple texte,
// à enrichir ensuite dans l'éditeur.
@Component({
  selector: 'app-term-form',
  imports: [ReactiveFormsModule, Segmented],
  templateUrl: './term-form.html',
  styleUrl: './term-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermForm {
  // Type imposé par l'écran ; null laisse le choix à l'utilisateur.
  readonly type = input<TermType | null>(null);
  // UE à laquelle le terme est rattaché.
  readonly ueCode = input.required<string>();
  // Préfixe des identifiants de champs : deux formulaires peuvent coexister dans la page.
  readonly idPrefix = input('term');
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<TermInput>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly typeOptions: SegmentedOption[] = [
    { value: 'definition', label: 'Définition' },
    { value: 'acronym', label: 'Acronyme' },
  ];
  protected readonly chosenType = signal<TermType>('definition');
  protected readonly effectiveType = computed(() => this.type() ?? this.chosenType());

  protected readonly form = this.formBuilder.group({
    label: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    expandedForm: ['', Validators.maxLength(300)],
    text: ['', Validators.maxLength(2000)],
  });

  protected submit(): void {
    const { label, expandedForm, text } = this.form.getRawValue();
    const isAcronym = this.effectiveType() === 'acronym';
    if (this.form.invalid || (isAcronym && expandedForm.trim().length === 0)) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit({
      type: this.effectiveType(),
      label: label.trim(),
      ...(isAcronym ? { expandedForm: expandedForm.trim() } : {}),
      ...(text.trim().length > 0 ? { content: paragraph(text.trim()) } : {}),
      ueCode: this.ueCode(),
    });
  }

  protected isInvalid(name: 'label' | 'text'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected isExpandedFormInvalid(): boolean {
    const control = this.form.controls.expandedForm;
    return control.touched && (control.invalid || control.value.trim().length === 0);
  }
}

function paragraph(text: string): ContentNode {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}
