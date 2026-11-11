import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentNode } from '../cours/content/content-node';
import { TermInput, TermType } from './term.service';

// Création rapide d'un terme : la définition saisie ici est un simple texte,
// à enrichir ensuite dans l'éditeur.
@Component({
  selector: 'app-term-form',
  imports: [ReactiveFormsModule],
  templateUrl: './term-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermForm {
  readonly type = input.required<TermType>();
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<TermInput>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    label: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    expandedForm: ['', Validators.maxLength(300)],
    text: ['', Validators.maxLength(2000)],
  });

  protected submit(): void {
    const { label, expandedForm, text } = this.form.getRawValue();
    const isAcronym = this.type() === 'acronym';
    if (this.form.invalid || (isAcronym && expandedForm.trim().length === 0)) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit({
      type: this.type(),
      label: label.trim(),
      ...(isAcronym ? { expandedForm: expandedForm.trim() } : {}),
      ...(text.trim().length > 0 ? { content: paragraph(text.trim()) } : {}),
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
