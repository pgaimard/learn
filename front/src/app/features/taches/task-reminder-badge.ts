import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isReminderDue } from './task-dates';
import { Task, TaskService } from './task.service';

const CLOCK_INTERVAL_MS = 60_000;

// Pastille du lien « Tâches » : nombre de tâches à faire dont le rappel est arrivé.
@Component({
  selector: 'app-task-reminder-badge',
  template: `
    @if (count() > 0) {
      <span class="badge">
        {{ count() }}<span class="visually-hidden"> à faire maintenant</span>
      </span>
    }
  `,
  styleUrl: './task-reminder-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskReminderBadge {
  private readonly taskService = inject(TaskService);

  private readonly tasks = signal<Task[]>([]);
  // Un rappel peut arriver pendant que l'application reste ouverte.
  private readonly now = signal(new Date());

  protected readonly count = computed(
    () => this.tasks().filter((task) => isReminderDue(task, this.now())).length,
  );

  constructor() {
    effect(() => {
      this.taskService.revision();
      // Une erreur ici ne doit rien afficher : la pastille est un simple rappel.
      this.taskService.list({ done: false }).subscribe({
        next: (tasks) => this.tasks.set(tasks),
        error: () => this.tasks.set([]),
      });
    });
    const clock = setInterval(() => this.now.set(new Date()), CLOCK_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }
}
