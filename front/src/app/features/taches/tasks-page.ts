import { NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Dropdown } from '../../core/ui/dropdown';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { ueOptions } from '../ue/ue-options';
import { Ue, UeService } from '../ue/ue.service';
import { formatDateTime, fromLocalInput, isOverdue, isReminderDue } from './task-dates';
import { TaskForm } from './task-form';
import { dueLabel, groupTasks } from './task-groups';
import { Task, TaskInput, TaskService } from './task.service';

// Valeur du filtre pour les tâches rattachées à aucune UE.
const WITHOUT_UE = '-';

@Component({
  selector: 'app-tasks-page',
  imports: [Dropdown, Icon, Modal, NgTemplateOutlet, ReactiveFormsModule, TaskForm],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly dialog = inject(DialogService);
  private readonly ueService = inject(UeService);

  protected readonly tasks = signal<Task[]>([]);
  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  // '' : toutes les UE.
  protected readonly ueFilter = signal('');
  // Pastilles de filtre : toutes, chaque UE, sans UE.
  protected readonly ueFilters = computed(() => [
    { value: '', label: 'Toutes' },
    ...this.ues().map((ue) => ({ value: ue.code, label: ue.code })),
    { value: WITHOUT_UE, label: 'Sans UE' },
  ]);
  protected readonly showDone = signal(false);
  // Tâche en cours de modification dans la fenêtre ; null si elle est fermée.
  protected readonly editing = signal<Task | null>(null);

  // Ajout rapide : un titre, et au besoin une UE et une échéance.
  protected readonly quickTitle = new FormControl('', { nonNullable: true });
  protected readonly quickUe = signal('');
  protected readonly quickDue = new FormControl('', { nonNullable: true });
  protected readonly isQuickDateShown = signal(false);
  protected readonly quickUeOptions = computed(() =>
    ueOptions(this.ues(), [{ value: '', label: 'UE' }]),
  );
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
  // Tâches à faire rangées par échéance : en retard, aujourd'hui, cette semaine…
  protected readonly groups = computed(() => groupTasks(this.todo(), this.now()));
  protected readonly summary = computed(() => {
    const late = this.todo().filter((task) => isOverdue(task, this.now())).length;
    return `${this.todo().length} à faire` + (late > 0 ? ` · ${late} en retard` : '');
  });

  protected readonly formatDateTime = formatDateTime;

  ngOnInit(): void {
    this.load();
  }

  protected isOverdue(task: Task): boolean {
    return isOverdue(task, this.now());
  }

  protected dueLabel(task: Task): string {
    return task.dueAt === null ? '' : dueLabel(task.dueAt, this.now());
  }

  // Le filtre par UE vaut aussi pour l'ajout rapide : la tâche créée y reste visible.
  protected filterBy(value: string): void {
    this.ueFilter.set(value);
    this.quickUe.set(value === WITHOUT_UE ? '' : value);
  }

  protected open(target: Task): void {
    this.formErrors.set([]);
    this.editing.set(target);
  }

  protected addQuickly(event: Event): void {
    // Formulaire natif : l'envoi par défaut rechargerait la page.
    event.preventDefault();
    const title = this.quickTitle.value.trim();
    if (title === '' || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.taskService
      .create({
        title,
        ueCode: this.quickUe() === '' ? null : this.quickUe(),
        dueAt: fromLocalInput(this.quickDue.value),
        remindAt: null,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.quickTitle.reset();
          this.quickDue.reset();
          this.isQuickDateShown.set(false);
          this.load();
        },
        error: (error: ApiError) => {
          this.isSaving.set(false);
          this.pageErrors.set(error.messages);
        },
      });
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
    this.taskService.update(target.id, input).subscribe({
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

  protected async remove(task: Task): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer la tâche',
      `La tâche « ${task.title} » sera supprimée.`,
    );
    if (!confirmed) {
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
