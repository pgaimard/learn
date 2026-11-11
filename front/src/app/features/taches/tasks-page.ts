import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Ue, UeService } from '../ue/ue.service';
import { formatDateTime, isOverdue, isReminderDue } from './task-dates';
import { TaskForm } from './task-form';
import { Task, TaskInput, TaskService } from './task.service';

// Valeur du filtre pour les tâches rattachées à aucune UE.
const WITHOUT_UE = '-';

@Component({
  selector: 'app-tasks-page',
  imports: [NgTemplateOutlet, TaskForm],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly ueService = inject(UeService);

  protected readonly withoutUe = WITHOUT_UE;
  protected readonly tasks = signal<Task[]>([]);
  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  // '' : toutes les UE.
  protected readonly ueFilter = signal('');
  protected readonly showDone = signal(false);
  // Tâche en cours de modification, « new » pour une création, null si aucun formulaire ouvert.
  protected readonly editing = signal<Task | 'new' | null>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  // Figé au chargement : sert à savoir ce qui est en retard ou à rappeler.
  private readonly now = signal(new Date());

  private readonly filtered = computed(() => {
    const filter = this.ueFilter();
    return this.tasks().filter(
      (task) =>
        filter === '' || (filter === WITHOUT_UE ? task.ue === null : task.ue?.code === filter),
    );
  });
  protected readonly todo = computed(() => this.filtered().filter((task) => !task.done));
  protected readonly done = computed(() => this.filtered().filter((task) => task.done));
  protected readonly reminders = computed(() =>
    this.todo().filter((task) => isReminderDue(task, this.now())),
  );
  protected readonly defaultUeCode = computed(() => {
    const filter = this.ueFilter();
    return filter === WITHOUT_UE ? '' : filter;
  });

  protected readonly formatDateTime = formatDateTime;

  ngOnInit(): void {
    this.load();
  }

  protected isOverdue(task: Task): boolean {
    return isOverdue(task, this.now());
  }

  protected open(target: Task | 'new'): void {
    this.formErrors.set([]);
    this.editing.set(target);
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected save(input: TaskInput): void {
    const target = this.editing();
    if (target === null || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const request =
      target === 'new' ? this.taskService.create(input) : this.taskService.update(target.id, input);
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

  protected toggle(task: Task): void {
    this.taskService.update(task.id, { done: !task.done }).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  protected remove(task: Task): void {
    if (!confirm(`Supprimer la tâche « ${task.title} » ?`)) {
      return;
    }
    this.taskService.remove(task.id).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  private load(): void {
    forkJoin({ tasks: this.taskService.list(), ues: this.ueService.list() }).subscribe({
      next: ({ tasks, ues }) => {
        this.tasks.set(tasks);
        this.ues.set(ues);
        this.now.set(new Date());
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
