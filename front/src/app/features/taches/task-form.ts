import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown } from '../../core/ui/dropdown';
import { ueOptions } from '../ue/ue-options';
import { Ue } from '../ue/ue.service';
import { fromLocalInput, toLocalInput } from './task-dates';
import { Task, TaskInput } from './task.service';

@Component({
  selector: 'app-task-form',
  imports: [Dropdown, ReactiveFormsModule],
  templateUrl: './task-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskForm implements OnInit {
  // Tâche à modifier ; null pour une création.
  readonly task = input<Task | null>(null);
  readonly ues = input.required<Ue[]>();
  protected readonly ueChoices = computed(() =>
    ueOptions(this.ues(), [{ value: '', label: 'Aucune' }]),
  );
  // UE proposée par défaut à la création (filtre en cours).
  readonly defaultUeCode = input('');
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<TaskInput>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    ueCode: [''],
    dueAt: [''],
    remindAt: [''],
  });

  ngOnInit(): void {
    const task = this.task();
    this.form.setValue({
      title: task?.title ?? '',
      ueCode: task ? (task.ue?.code ?? '') : this.defaultUeCode(),
      dueAt: toLocalInput(task?.dueAt ?? null),
      remindAt: toLocalInput(task?.remindAt ?? null),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, ueCode, dueAt, remindAt } = this.form.getRawValue();
    this.saved.emit({
      title: title.trim(),
      ueCode: ueCode === '' ? null : ueCode,
      dueAt: fromLocalInput(dueAt),
      remindAt: fromLocalInput(remindAt),
    });
  }

  protected isTitleInvalid(): boolean {
    return this.form.controls.title.touched && this.form.controls.title.invalid;
  }
}
