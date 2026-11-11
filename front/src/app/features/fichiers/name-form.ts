import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  OnInit,
  output,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// Saisie du nom d'un dossier ou d'un fichier, à la création comme au renommage.
@Component({
  selector: 'app-name-form',
  imports: [ReactiveFormsModule],
  templateUrl: './name-form.html',
  styleUrl: './name-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameForm implements OnInit {
  readonly label = input.required<string>();
  readonly initialName = input('');
  readonly submitLabel = input('Enregistrer');
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<string>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly form = this.formBuilder.group({
    name: [
      '',
      [Validators.required, Validators.pattern(/^[^/\\]*\S[^/\\]*$/), Validators.maxLength(255)],
    ],
  });

  constructor() {
    // Le formulaire apparaît à la demande : le curseur va directement dans le champ.
    afterNextRender(() => {
      this.field().nativeElement.focus();
      this.field().nativeElement.select();
    });
  }

  ngOnInit(): void {
    this.form.setValue({ name: this.initialName() });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit(this.form.controls.name.value.trim());
  }

  protected isInvalid(): boolean {
    return this.form.controls.name.touched && this.form.controls.name.invalid;
  }
}
