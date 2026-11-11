import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { UeService } from '../ue/ue.service';
import { Task, TaskService } from './task.service';
import { TasksPage } from './tasks-page';

const HOUR = 3_600_000;
const UES = [
  { id: 1, code: 'UTC502', title: 'Systèmes', description: '', position: 1 },
  { id: 2, code: 'NFE108', title: 'Méthodes', description: '', position: 2 },
];

function task(id: number, title: string, changes: Partial<Task> = {}): Task {
  return { id, title, ue: null, dueAt: null, remindAt: null, done: false, ...changes };
}

describe('TasksPage', () => {
  let fixture: ComponentFixture<TasksPage>;
  const service = {
    list: vi.fn<TaskService['list']>(),
    create: vi.fn<TaskService['create']>(),
    update: vi.fn<TaskService['update']>(),
    remove: vi.fn<TaskService['remove']>(),
    revision: signal(0),
  };

  function setup(tasks: Task[]): void {
    service.list.mockReturnValue(of(tasks));
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskService, useValue: service },
        { provide: UeService, useValue: { list: () => of(UES) } },
      ],
    });
    fixture = TestBed.createComponent(TasksPage);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector?: string): string {
    const target = selector ? element().querySelector(selector) : element();
    return (target?.textContent ?? '').replace(/\s+/g, ' ');
  }

  function titles(list: string): string[] {
    return Array.from(element().querySelectorAll(`[aria-label="${list}"] .task-title`)).map(
      (title) => title.textContent.trim(),
    );
  }

  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find(
        (button) =>
          button.textContent.trim().startsWith(label) ||
          button.getAttribute('aria-label') === label,
      )
      ?.click();
    fixture.detectChanges();
  }

  function fill(id: string, value: string, event = 'input'): void {
    const field = element().querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event(event));
    }
    fixture.detectChanges();
  }

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => vi.resetAllMocks());

  it('sépare les tâches à faire des tâches faites, masquées par défaut', () => {
    setup([task(1, 'Réviser'), task(2, 'Déjà fait', { done: true })]);

    expect(titles('Tâches à faire')).toEqual(['Réviser']);
    expect(element().querySelector('[aria-label="Tâches faites"]')).toBeNull();

    click('Afficher les tâches faites');

    expect(titles('Tâches faites')).toEqual(['Déjà fait']);
  });

  it('signale les rappels arrivés et les échéances dépassées', () => {
    const past = new Date(Date.now() - HOUR).toISOString();
    const future = new Date(Date.now() + 48 * HOUR).toISOString();
    setup([
      task(1, 'Rendre le rapport', { dueAt: past, remindAt: past }),
      task(2, 'Réviser', { dueAt: future, remindAt: future }),
    ]);

    expect(text('.reminders')).toContain('À faire maintenant');
    expect(text('.reminders')).toContain('Rendre le rapport');
    expect(text('.reminders')).not.toContain('Réviser');
    expect(element().querySelectorAll('.overdue')).toHaveLength(1);
    expect(text('.overdue')).toContain('En retard');
  });

  it('filtre par UE, y compris les tâches sans UE', () => {
    setup([
      task(1, 'TP systèmes', { ue: { code: 'UTC502', title: 'Systèmes' } }),
      task(2, 'Acheter un cahier'),
    ]);

    fill('task-ue-filter', 'UTC502', 'change');
    expect(titles('Tâches à faire')).toEqual(['TP systèmes']);

    fill('task-ue-filter', '-', 'change');
    expect(titles('Tâches à faire')).toEqual(['Acheter un cahier']);

    fill('task-ue-filter', 'NFE108', 'change');
    expect(text()).toContain('Aucune tâche à faire.');
  });

  it('crée une tâche dans l’UE filtrée, avec son échéance', () => {
    setup([]);
    service.create.mockReturnValue(of(task(3, 'Réviser')));
    fill('task-ue-filter', 'UTC502', 'change');
    click('Nouvelle tâche');

    fill('task-title', ' Réviser ');
    fill('task-due', '2026-12-15T18:00');
    submit();

    expect(service.create).toHaveBeenCalledWith({
      title: 'Réviser',
      ueCode: 'UTC502',
      dueAt: new Date(2026, 11, 15, 18, 0).toISOString(),
      remindAt: null,
    });
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(element().querySelector('form')).toBeNull();
  });

  it('refuse un titre vide et affiche un refus de l’API', () => {
    setup([]);
    click('Nouvelle tâche');
    submit();
    expect(service.create).not.toHaveBeenCalled();
    expect(text()).toContain('Le titre est requis');

    service.create.mockReturnValue(
      throwError(() => new ApiError(400, ['L’UE ABC123 n’existe pas.'])),
    );
    fill('task-title', 'Réviser');
    submit();

    expect(text()).toContain('L’UE ABC123 n’existe pas.');
    expect(element().querySelector('form')).not.toBeNull();
  });

  it('coche une tâche puis recharge la liste', () => {
    setup([task(1, 'Réviser')]);
    service.update.mockReturnValue(of(task(1, 'Réviser', { done: true })));

    element().querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();

    expect(service.update).toHaveBeenCalledWith(1, { done: true });
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('modifie une tâche en effaçant son UE', () => {
    setup([task(1, 'Réviser', { ue: { code: 'UTC502', title: 'Systèmes' } })]);
    service.update.mockReturnValue(of(task(1, 'Réviser le chapitre 3')));
    click('Modifier la tâche Réviser');

    fill('task-title', 'Réviser le chapitre 3');
    fill('task-ue', '', 'change');
    submit();

    expect(service.update).toHaveBeenCalledWith(1, {
      title: 'Réviser le chapitre 3',
      ueCode: null,
      dueAt: null,
      remindAt: null,
    });
  });

  it('supprime une tâche après confirmation seulement', () => {
    setup([task(1, 'Réviser')]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    service.remove.mockReturnValue(of(undefined));

    click('Supprimer la tâche Réviser');
    expect(service.remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    click('Supprimer la tâche Réviser');
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
