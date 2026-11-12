import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { createOrderSaver } from '../../core/sortable/order-saver';
import {
  moveItem,
  SortableHandle,
  SortableItem,
  SortableList,
  SortChange,
} from '../../core/sortable/sortable';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { AgendaEvent, EventService } from '../agenda/event.service';
import { addDays, buildWeek, formatTime, startOfWeek } from '../agenda/week';
import { Task, TaskService } from '../taches/task.service';
import { UeForm } from './ue-form';
import { Ue, UeInput, UeService } from './ue.service';

// Ligne du bloc « Cette semaine ».
interface WeekEntry {
  key: string;
  day: string;
  title: string;
  ueCode: string | null;
  kind: 'Cours' | 'Échéance' | 'Tâche';
}

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });

@Component({
  selector: 'app-ue-list-page',
  imports: [Icon, Modal, RouterLink, SortableHandle, SortableItem, SortableList, UeForm],
  templateUrl: './ue-list-page.html',
  styleUrl: './ue-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeListPage implements OnInit {
  private readonly ueService = inject(UeService);
  private readonly dialog = inject(DialogService);
  private readonly eventService = inject(EventService);
  private readonly taskService = inject(TaskService);

  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  // UE en cours de modification, « new » pour une création, null si aucun formulaire ouvert.
  protected readonly editing = signal<Ue | 'new' | null>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  private readonly weekEvents = signal<AgendaEvent[]>([]);
  private readonly weekTasks = signal<Task[]>([]);
  // Événements et tâches de la semaine en cours, jour par jour.
  protected readonly weekEntries = computed<WeekEntry[]>(() =>
    buildWeek(startOfWeek(new Date()), this.weekEvents(), this.weekTasks()).flatMap(
      ({ date, entries }) => {
        const day = DAY_FORMAT.format(date);
        return entries.map((entry): WeekEntry =>
          entry.kind === 'event'
            ? {
                key: `event-${entry.event.id}-${day}`,
                day: `${day} ${formatTime(entry.event.startsAt)}`,
                title: entry.event.title,
                ueCode: entry.event.ue?.code ?? null,
                kind: entry.event.type === 'deadline' ? 'Échéance' : 'Cours',
              }
            : {
                key: `task-${entry.task.id}`,
                day: `${day} ${formatTime(entry.time)}`,
                title: entry.task.title,
                ueCode: entry.task.ue?.code ?? null,
                kind: 'Tâche',
              },
        );
      },
    ),
  );

  private readonly saveOrder = createOrderSaver<string[]>(
    (codes) => this.ueService.reorder(codes),
    () => this.pageErrors.set([]),
    (error) => this.load(error.messages),
  );

  ngOnInit(): void {
    this.load();
    this.loadWeek();
  }

  protected plural(count: number, one: string, many: string): string {
    return `${count} ${count > 1 ? many : one}`;
  }

  protected open(target: Ue | 'new'): void {
    this.formErrors.set([]);
    this.editing.set(target);
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected save(input: UeInput): void {
    const target = this.editing();
    if (target === null || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const request =
      target === 'new' ? this.ueService.create(input) : this.ueService.update(target.code, input);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.close();
        this.load();
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.formErrors.set(error.messages);
      },
    });
  }

  // L'ordre change tout de suite à l'écran, puis il est enregistré ; en cas de refus,
  // la liste est rechargée telle qu'elle est en base.
  protected reorder(change: SortChange): void {
    const ordered = moveItem(this.ues(), change);
    if (ordered.every((ue, index) => ue === this.ues()[index])) {
      return;
    }
    this.ues.set(ordered);
    this.saveOrder(ordered.map((ue) => ue.code));
  }

  protected async remove(ue: Ue): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer l’UE',
      `L’UE ${ue.code} sera supprimée. Elle doit être vide.`,
    );
    if (!confirmed) {
      return;
    }
    this.ueService.remove(ue.code).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  // Le bloc « Cette semaine » est un complément : son échec ne bloque pas la page.
  private loadWeek(): void {
    const from = startOfWeek(new Date());
    const to = addDays(from, 7);
    forkJoin({
      events: this.eventService.list(from, to),
      tasks: this.taskService.list({
        done: false,
        dueFrom: from.toISOString(),
        dueTo: to.toISOString(),
      }),
    }).subscribe({
      next: ({ events, tasks }) => {
        this.weekEvents.set(events);
        this.weekTasks.set(tasks);
      },
      error: () => undefined,
    });
  }

  // messages : erreur à laisser affichée une fois la liste rechargée.
  private load(messages: string[] = []): void {
    this.ueService.list().subscribe({
      next: (ues) => {
        this.ues.set(ues);
        this.pageErrors.set(messages);
        this.isLoading.set(false);
      },
      error: (error: ApiError) => {
        this.pageErrors.set(error.messages);
        this.isLoading.set(false);
      },
    });
  }
}
