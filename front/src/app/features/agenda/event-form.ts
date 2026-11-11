import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { fromLocalInput, toLocalInput } from '../taches/task-dates';
import { Ue } from '../ue/ue.service';
import { AgendaEvent, EventDetails, EventType, Occurrence } from './event.service';
import { weeklyOccurrences } from './week';

export interface EventFormValue {
  details: EventDetails;
  // Une seule occurrence pour une modification ou un événement non répété.
  occurrences: Occurrence[];
}

const HOUR_MS = 60 * 60 * 1000;

@Component({
  selector: 'app-event-form',
  imports: [ReactiveFormsModule],
  templateUrl: './event-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventForm implements OnInit {
  // Événement à modifier ; null pour une création.
  readonly event = input<AgendaEvent | null>(null);
  // Jour proposé à la création.
  readonly day = input<Date | null>(null);
  readonly ues = input.required<Ue[]>();
  readonly defaultUeCode = input('');
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<EventFormValue>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly type = signal<EventType>('course');
  protected readonly periodError = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    type: this.formBuilder.control<EventType>('course'),
    ueCode: [''],
    startsAt: ['', Validators.required],
    endsAt: [''],
    repeatUntil: [''],
  });

  ngOnInit(): void {
    const event = this.event();
    const start = event ? new Date(event.startsAt) : defaultStart(this.day());
    const end = event ? new Date(event.endsAt) : new Date(start.getTime() + HOUR_MS);
    this.type.set(event?.type ?? 'course');
    this.form.setValue({
      title: event?.title ?? '',
      type: this.type(),
      ueCode: event ? (event.ue?.code ?? '') : this.defaultUeCode(),
      startsAt: toLocalInput(start.toISOString()),
      endsAt: toLocalInput(end.toISOString()),
      repeatUntil: '',
    });
  }

  protected submit(): void {
    const { title, type, ueCode, startsAt, endsAt, repeatUntil } = this.form.getRawValue();
    const start = toDate(startsAt);
    // Une échéance est ponctuelle : sa fin est son début.
    const end = type === 'deadline' ? start : toDate(endsAt);
    this.periodError.set(periodProblem(start, end));
    if (this.form.invalid || !start || !end || this.periodError() !== null) {
      this.form.markAllAsTouched();
      return;
    }
    const until = repeatUntil === '' ? null : new Date(`${repeatUntil}T00:00`);
    this.saved.emit({
      details: { title: title.trim(), type, ueCode: ueCode === '' ? null : ueCode },
      occurrences: weeklyOccurrences(start, end, this.event() ? null : until),
    });
  }

  protected isTitleInvalid(): boolean {
    return this.form.controls.title.touched && this.form.controls.title.invalid;
  }
}

// À la création : le jour choisi (ou aujourd'hui) à 9 h, heure locale.
function defaultStart(day: Date | null): Date {
  const base = day ?? new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0);
}

function toDate(localValue: string): Date | null {
  const iso = fromLocalInput(localValue);
  return iso === null ? null : new Date(iso);
}

function periodProblem(start: Date | null, end: Date | null): string | null {
  if (!start || !end) {
    return 'Le début et la fin sont requis.';
  }
  return end < start ? 'La fin ne peut pas précéder le début.' : null;
}
