import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateField } from '../../core/ui/date-field';
import { formatTime, formatValue, isSameDay, parseValue } from '../../core/ui/date-field-values';
import { Dropdown } from '../../core/ui/dropdown';
import { Segmented, SegmentedOption } from '../../core/ui/segmented';
import { ueOptions } from '../ue/ue-options';
import { Ue } from '../ue/ue.service';
import { AgendaEvent, EventDetails, EventType, Occurrence } from './event.service';
import { endTimeOptions, shiftTime, startTimeOptions, toMinutes } from './event-times';
import { weeklyOccurrences } from './week';

export interface EventFormValue {
  details: EventDetails;
  // Une seule occurrence pour une modification ou un événement non répété.
  occurrences: Occurrence[];
}

const HOUR_MS = 60 * 60 * 1000;

@Component({
  selector: 'app-event-form',
  imports: [DateField, Dropdown, Segmented, ReactiveFormsModule],
  templateUrl: './event-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventForm implements OnInit {
  // Événement à modifier ; null pour une création.
  readonly event = input<AgendaEvent | null>(null);
  // Jour proposé à la création.
  readonly day = input<Date | null>(null);
  readonly ues = input.required<Ue[]>();
  protected readonly ueChoices = computed(() =>
    ueOptions(this.ues(), [{ value: '', label: 'Aucune' }]),
  );
  protected readonly typeOptions: SegmentedOption[] = [
    { value: 'course', label: 'Cours' },
    { value: 'deadline', label: 'Échéance' },
  ];
  readonly defaultUeCode = input('');
  readonly errors = input<string[]>([]);
  readonly isSaving = input(false);

  readonly saved = output<EventFormValue>();
  readonly cancelled = output();

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly type = signal<EventType>('course');

  // Heures choisies, pour proposer les fins possibles après le début.
  protected readonly startTime = signal('');
  protected readonly endTime = signal('');
  protected readonly startOptions = computed(() => startTimeOptions(this.startTime()));
  protected readonly endOptions = computed(() => endTimeOptions(this.startTime(), this.endTime()));

  // Un événement tient dans une journée : une date, une heure de début et une de fin.
  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    type: this.formBuilder.control<EventType>('course'),
    ueCode: [''],
    day: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: [''],
    repeatUntil: [''],
  });

  ngOnInit(): void {
    const event = this.event();
    const start = event ? new Date(event.startsAt) : defaultStart(this.day());
    const end = event ? new Date(event.endsAt) : new Date(start.getTime() + HOUR_MS);
    this.type.set(event?.type ?? 'course');
    this.startTime.set(formatTime(start));
    // Une échéance devenue cours, ou une fin un autre jour : une heure après le début.
    this.endTime.set(
      isSameDay(start, end) && end > start ? formatTime(end) : shiftTime(this.startTime(), 60),
    );
    this.form.setValue({
      title: event?.title ?? '',
      description: event?.description ?? '',
      type: this.type(),
      ueCode: event ? (event.ue?.code ?? '') : this.defaultUeCode(),
      day: formatValue(start, false),
      startTime: this.startTime(),
      endTime: this.endTime(),
      repeatUntil: '',
    });
  }

  // Le début change : la fin suit, pour garder la durée.
  protected moveStart(startTime: string): void {
    const duration = toMinutes(this.endTime()) - toMinutes(this.startTime());
    this.startTime.set(startTime);
    this.endTime.set(shiftTime(startTime, duration));
    this.form.controls.endTime.setValue(this.endTime());
  }

  protected submit(): void {
    const { title, description, type, ueCode, day, startTime, endTime, repeatUntil } =
      this.form.getRawValue();
    const start = parseValue(`${day}T${startTime}`);
    // Une échéance est ponctuelle : sa fin est son début.
    const end = type === 'deadline' ? start : parseValue(`${day}T${endTime}`);
    if (this.form.invalid || !start || !end) {
      this.form.markAllAsTouched();
      return;
    }
    const until = repeatUntil === '' ? null : new Date(`${repeatUntil}T00:00`);
    this.saved.emit({
      details: {
        title: title.trim(),
        description: description.trim(),
        type,
        ueCode: ueCode === '' ? null : ueCode,
      },
      occurrences: weeklyOccurrences(start, end, this.event() ? null : until),
    });
  }

  protected isDescriptionInvalid(): boolean {
    return this.form.controls.description.invalid;
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
