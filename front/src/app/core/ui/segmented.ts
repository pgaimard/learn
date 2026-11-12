import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SegmentedOption {
  value: string;
  label: string;
}

// Choix entre deux ou trois valeurs, toutes visibles : des boutons accolés.
@Component({
  selector: 'app-segmented',
  template: `
    <div class="segments" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          [class.is-on]="option.value === current()"
          [attr.aria-pressed]="option.value === current()"
          (click)="choose(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './segmented.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Segmented), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Segmented implements ControlValueAccessor {
  readonly options = input.required<SegmentedOption[]>();
  readonly label = input.required<string>();
  // Valeur posée par le gabarit ou par le formulaire ; seul un choix de l'utilisateur
  // émet valueChange.
  readonly value = input('');
  readonly valueChange = output<string>();
  protected readonly current = linkedSignal(() => this.value());

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.current.set(value ?? '');
  }

  registerOnChange(onChange: (value: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  protected choose(value: string): void {
    this.onTouched();
    if (value !== this.current()) {
      this.current.set(value);
      this.valueChange.emit(value);
      this.onChange(value);
    }
  }
}
