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
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, Observable } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { formatDateTime } from '../taches/task-dates';
import { TaskForm } from '../taches/task-form';
import { Task, TaskInput, TaskService } from '../taches/task.service';
import { Ue, UeService } from '../ue/ue.service';
import {
  AgendaItem,
  addMonths,
  itemsOfDay,
  monthGrid,
  startOfMonth,
  toAgendaItems,
  toneOf,
} from './calendar';
import { EventForm, EventFormValue } from './event-form';
import { AgendaEvent, EventService } from './event.service';
import { MiniCalendar } from './mini-calendar';
import { MonthGrid } from './month-grid';
import { WeekGrid } from './week-grid';
import {
  addDays,
  buildWeek,
  formatDay,
  formatTime,
  formatWeekParam,
  isSameDay,
  parseDateParam,
  startOfWeek,
} from './week';

// Formulaire ouvert : création un jour donné, ou modification d'un événement.
// Fenêtre ouverte : création un jour donné, ou un événement ou une tâche, d'abord en
// lecture (« view »), puis en modification (« edit ») sans quitter la fenêtre.
type Editing =
  | { kind: 'new'; day: Date }
  | { kind: 'event'; event: AgendaEvent; mode: 'view' | 'edit' }
  | { kind: 'task'; task: Task; mode: 'view' | 'edit' }
  | null;

type View = 'semaine' | 'mois' | 'liste';
type Kind = 'course' | 'deadline' | 'task';

const VIEWS: { value: View; label: string; key: string }[] = [
  { value: 'semaine', label: 'Semaine', key: 's' },
  { value: 'mois', label: 'Mois', key: 'm' },
  { value: 'liste', label: 'Liste', key: 'l' },
];
const KINDS: { value: Kind; label: string }[] = [
  { value: 'course', label: 'Cours' },
  { value: 'deadline', label: 'Échéances' },
  { value: 'task', label: 'Tâches datées' },
];
// Clé du filtre pour ce qui n'est rattaché à aucune UE.
const WITHOUT_UE = '-';
const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

// Une saisie en cours ne doit pas déclencher un raccourci du planning.
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

@Component({
  selector: 'app-agenda-page',
  imports: [EventForm, Icon, MiniCalendar, Modal, MonthGrid, RouterLink, TaskForm, WeekGrid],
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage {
  // Paramètre de requête ?semaine=AAAA-MM-JJ : un jour de la période affichée ;
  // aujourd'hui par défaut.
  readonly semaine = input<string>();
  // Paramètre de requête ?vue=semaine, mois ou liste.
  readonly vue = input<string>();

  private readonly eventService = inject(EventService);
  private readonly dialog = inject(DialogService);
  private readonly taskService = inject(TaskService);
  private readonly ueService = inject(UeService);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  protected readonly today = new Date();
  protected readonly views = VIEWS;
  protected readonly kinds = KINDS;
  protected readonly withoutUe = WITHOUT_UE;
  protected readonly view = computed<View>(() => {
    const view = this.vue();
    return view === 'mois' || view === 'liste' ? view : 'semaine';
  });
  // Jour désigné par l'adresse : sa semaine et son mois sont ceux affichés.
  protected readonly anchor = computed(() => parseDateParam(this.semaine(), this.today));
  protected readonly weekStart = computed(() => startOfWeek(this.anchor()));
  protected readonly weekEnd = computed(() => addDays(this.weekStart(), 6));
  protected readonly events = signal<AgendaEvent[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  protected readonly notice = signal('');
  // Filtres : codes d'UE (ou « sans UE ») et types masqués. Rien n'est masqué au départ.
  protected readonly hiddenUes = signal<ReadonlySet<string>>(new Set());
  protected readonly hiddenKinds = signal<ReadonlySet<Kind>>(new Set());
  // Premier jour du mois affiché en vue Mois et dans le petit calendrier.
  protected readonly month = computed(() => startOfMonth(this.anchor()));
  protected readonly ueCodes = computed(() => this.ues().map((ue) => ue.code));
  protected readonly heading = computed(() => {
    if (this.view() === 'mois') {
      const month = this.month();
      return { main: MONTH_LABEL.format(month), detail: String(month.getFullYear()) };
    }
    const start = this.weekStart();
    const end = this.weekEnd();
    const startMonth = start.getMonth() === end.getMonth() ? '' : ` ${MONTH_LABEL.format(start)}`;
    return {
      main: `${start.getDate()}${startMonth} – ${end.getDate()} ${MONTH_LABEL.format(end)}`,
      detail: String(end.getFullYear()),
    };
  });
  protected readonly editing = signal<Editing>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  private readonly visibleEvents = computed(() =>
    this.events().filter((event) => this.showsUe(event.ue) && !this.hiddenKinds().has(event.type)),
  );
  private readonly visibleTasks = computed(() =>
    this.hiddenKinds().has('task') ? [] : this.tasks().filter((task) => this.showsUe(task.ue)),
  );
  // Vue Liste : la semaine, jour par jour.
  protected readonly days = computed(() =>
    buildWeek(this.weekStart(), this.visibleEvents(), this.visibleTasks()),
  );
  // Vues Semaine et Mois, petit calendrier.
  protected readonly items = computed(() =>
    toAgendaItems(this.visibleEvents(), this.visibleTasks(), this.ueCodes()),
  );

  protected readonly formatDay = formatDay;
  protected readonly formatTime = formatTime;
  protected readonly formatDateTime = formatDateTime;

  constructor() {
    effect(() => {
      const weekStart = this.weekStart();
      this.title.setTitle(`Agenda – semaine du ${formatDay(weekStart)}`);
      this.editing.set(null);
      this.notice.set('');
      this.load();
    });
  }

  // Période voisine : une semaine, ou un mois en vue Mois.
  protected neighbour(step: -1 | 1): Date {
    return this.view() === 'mois'
      ? addMonths(this.anchor(), step)
      : addDays(this.weekStart(), 7 * step);
  }

  protected dateQuery(date: Date): { semaine: string } {
    return { semaine: formatWeekParam(date) };
  }

  protected toneOf(code: string): string {
    return toneOf(code, this.ueCodes());
  }

  protected goTo(date: Date | null, view: View = this.view()): void {
    void this.router.navigate([], {
      queryParams: { semaine: date ? formatWeekParam(date) : null, vue: view },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleUe(code: string): void {
    this.hiddenUes.update((hidden) => toggled(hidden, code));
  }

  protected toggleKind(kind: Kind): void {
    this.hiddenKinds.update((hidden) => toggled(hidden, kind));
  }

  // Raccourcis : flèches pour la période voisine, T pour aujourd'hui, S, M, L pour la vue.
  protected onKey(event: KeyboardEvent): void {
    if (
      this.editing() !== null ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTyping(event.target)
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    const view = VIEWS.find((candidate) => candidate.key === key);
    if (key === 'arrowleft' || key === 'arrowright') {
      this.goTo(this.neighbour(key === 'arrowleft' ? -1 : 1));
    } else if (key === 't') {
      this.goTo(null);
    } else if (view) {
      this.goTo(this.anchor(), view.value);
    } else {
      return;
    }
    event.preventDefault();
  }

  // Jour proposé pour un nouvel événement : aujourd'hui s'il est affiché, sinon le
  // premier jour de la période.
  protected defaultDay(): Date {
    if (this.view() === 'mois') {
      const month = this.month();
      const isCurrent =
        month.getMonth() === this.today.getMonth() &&
        month.getFullYear() === this.today.getFullYear();
      return isCurrent ? this.today : month;
    }
    return this.days().some((day) => isSameDay(day.date, this.today))
      ? this.today
      : this.weekStart();
  }

  protected hasItems(date: Date): boolean {
    return itemsOfDay(this.items(), date).length > 0;
  }

  private showsUe(ue: { code: string } | null): boolean {
    return !this.hiddenUes().has(ue?.code ?? WITHOUT_UE);
  }

  protected isToday(date: Date): boolean {
    return isSameDay(date, this.today);
  }

  protected open(editing: Editing): void {
    this.formErrors.set([]);
    this.editing.set(editing);
  }

  // Ouvre le détail de l'élément cliqué dans une grille.
  protected show(item: AgendaItem): void {
    if (item.event) {
      this.open({ kind: 'event', event: item.event, mode: 'view' });
    } else if (item.task) {
      this.open({ kind: 'task', task: item.task, mode: 'view' });
    }
  }

  // Titre de la fenêtre selon ce qu'elle montre.
  protected modalHeading(editing: NonNullable<Editing>): string {
    if (editing.kind === 'new') {
      return 'Nouvel événement';
    }
    if (editing.kind === 'event') {
      return editing.mode === 'edit' ? 'Modifier l’événement' : editing.event.title;
    }
    return editing.mode === 'edit' ? 'Modifier la tâche' : editing.task.title;
  }

  // Passe du détail à la modification, dans la même fenêtre.
  protected edit(): void {
    const editing = this.editing();
    if (editing && editing.kind !== 'new') {
      this.open({ ...editing, mode: 'edit' });
    }
  }

  protected saveTask(input: TaskInput): void {
    const editing = this.editing();
    if (editing?.kind !== 'task' || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.taskService.update(editing.task.id, input).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.formErrors.set(error.messages);
      },
    });
  }

  protected toggleTask(task: Task): void {
    this.taskService.update(task.id, { done: !task.done }).subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (error: ApiError) => this.formErrors.set(error.messages),
    });
  }

  protected async removeTask(task: Task): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer la tâche',
      `La tâche « ${task.title} » sera supprimée.`,
    );
    if (!confirmed) {
      return;
    }
    this.taskService.remove(task.id).subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (error: ApiError) => this.formErrors.set(error.messages),
    });
  }

  protected save(value: EventFormValue): void {
    const editing = this.editing();
    if (editing === null || editing.kind === 'task' || this.isSaving()) {
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

  protected async remove(event: AgendaEvent): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer l’événement',
      `« ${event.title} » du ${formatDay(new Date(event.startsAt))} sera supprimé.`,
    );
    if (!confirmed) {
      return;
    }
    this.eventService.remove(event.id).subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  private load(): void {
    // Une seule lecture couvre la semaine et les six semaines du mois affiché.
    const grid = monthGrid(this.anchor());
    const from = grid[0] < this.weekStart() ? grid[0] : this.weekStart();
    const to = addDays(grid[41] > this.weekEnd() ? grid[41] : this.weekEnd(), 1);
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

function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
}
