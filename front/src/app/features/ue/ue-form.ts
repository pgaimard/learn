import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Ue, UeInput } from './ue.service';

@Component({
  selector: 'app-ue-form',
  imports: [ReactiveFormsModule],
  templateUrl: './ue-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeForm implements OnInit {
  readonly ue = input<Ue | null>(null);
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<UeInput>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    code: ['', [Validators.required, Validators.pattern(/^\s*[A-Za-z0-9]{3,10}\s*$/)]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    position: this.formBuilder.control<number | null>(null, Validators.min(0)),
  });

  ngOnInit(): void {
    const ue = this.ue();
    if (ue) {
      this.form.setValue({
        code: ue.code,
        title: ue.title,
        description: ue.description,
        position: ue.position,
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { code, title, description, position } = this.form.getRawValue();
    this.saved.emit({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      ...(position === null ? {} : { position }),
    });
  }

  protected isInvalid(name: 'code' | 'title' | 'description' | 'position'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
}
