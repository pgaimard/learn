import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Task, TaskService } from '../taches/task.service';
import { Ue, UeService } from '../ue/ue.service';
import { EventForm, EventFormValue } from './event-form';
import { AgendaEvent, EventService } from './event.service';
import {
  addDays,
  buildWeek,
  formatDay,
  formatTime,
  formatWeekParam,
  isSameDay,
  parseWeekParam,
} from './week';

// Formulaire ouvert : création un jour donné, ou modification d'un événement.
type Editing = { kind: 'new'; day: Date } | { kind: 'edit'; event: AgendaEvent } | null;

// Valeur du filtre pour ce qui n'est rattaché à aucune UE.
const WITHOUT_UE = '-';

function matchesUe(item: { ue: { code: string } | null }, filter: string): boolean {
  return filter === '' || (filter === WITHOUT_UE ? item.ue === null : item.ue?.code === filter);
}

@Component({
  selector: 'app-agenda-page',
  imports: [EventForm, RouterLink],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage {
  // Paramètre de requête ?semaine=AAAA-MM-JJ ; la semaine en cours par défaut.
  readonly semaine = input<string>();

  private readonly eventService = inject(EventService);
  private readonly taskService = inject(TaskService);
  private readonly ueService = inject(UeService);
  private readonly title = inject(Title);

  private readonly today = new Date();
  protected readonly withoutUe = WITHOUT_UE;
  protected readonly weekStart = computed(() => parseWeekParam(this.semaine(), this.today));
  protected readonly weekEnd = computed(() => addDays(this.weekStart(), 6));
  protected readonly events = signal<AgendaEvent[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  protected readonly notice = signal('');
  // '' : toutes les UE.
  protected readonly ueFilter = signal('');
  protected readonly editing = signal<Editing>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  protected readonly days = computed(() =>
    buildWeek(
      this.weekStart(),
      this.events().filter((event) => matchesUe(event, this.ueFilter())),
      this.tasks().filter((task) => matchesUe(task, this.ueFilter())),
    ),
  );
  protected readonly defaultUeCode = computed(() => {
    const filter = this.ueFilter();
    return filter === WITHOUT_UE ? '' : filter;
  });

  protected readonly formatDay = formatDay;
  protected readonly formatTime = formatTime;

  constructor() {
    effect(() => {
      const weekStart = this.weekStart();
      this.title.setTitle(`Agenda – semaine du ${formatDay(weekStart)}`);
      this.editing.set(null);
      this.notice.set('');
      this.load();
    });
  }

  protected weekQuery(offsetWeeks: number): { semaine: string } {
    return { semaine: formatWeekParam(addDays(this.weekStart(), 7 * offsetWeeks)) };
  }

  protected isToday(date: Date): boolean {
    return isSameDay(date, this.today);
  }

  protected isEditing(event: AgendaEvent): boolean {
    const editing = this.editing();
    return editing?.kind === 'edit' && editing.event.id === event.id;
  }

  protected isAdding(day: Date): boolean {
    const editing = this.editing();
    return editing?.kind === 'new' && isSameDay(editing.day, day);
  }

  protected open(editing: Editing): void {
    this.formErrors.set([]);
    this.editing.set(editing);
  }

  protected save(value: EventFormValue): void {
    const editing = this.editing();
    if (editing === null || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    // Une modification ne touche qu'un événement : même forme de réponse qu'une création.
    const request: Observable<AgendaEvent[]> =
      editing.kind === 'new'
        ? this.eventService.create(value.details, value.occurrences)
        : this.eventService
            .update(editing.event.id, { ...value.details, ...value.occurrences[0] })
            .pipe(map((event) => [event]));
    request.subscribe({
      next: (saved) => {
        this.isSaving.set(false);
        this.editing.set(null);
        this.notice.set(
          saved.length > 1 ? `${saved.length} événements créés, un par semaine.` : '',
        );
        this.load();
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.formErrors.set(error.messages);
      },
    });
  }

  protected remove(event: AgendaEvent): void {
    if (!confirm(`Supprimer « ${event.title} » du ${formatDay(new Date(event.startsAt))} ?`)) {
      return;
    }
    this.eventService.remove(event.id).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  private load(): void {
    const from = this.weekStart();
    const to = addDays(from, 7);
    forkJoin({
      events: this.eventService.list(from, to),
      tasks: this.taskService.list({ dueFrom: from.toISOString(), dueTo: to.toISOString() }),
      ues: this.ueService.list(),
    }).subscribe({
      next: ({ events, tasks, ues }) => {
        this.events.set(events);
        this.tasks.set(tasks);
        this.ues.set(ues);
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
