import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { setDate } from '../../core/ui/date-field.testing';
import { pickOption } from '../../core/ui/dropdown.testing';
import { DialogService } from '../../core/dialog/dialog.service';
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
  const dialog = {
    confirm: vi.fn<DialogService['confirm']>(),
    confirmDeletion: vi.fn<DialogService['confirmDeletion']>(),
  };

  // La modale répond de façon asynchrone : on laisse la réponse arriver.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function setup(tasks: Task[]): void {
    service.list.mockReturnValue(of(tasks));
    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: dialog },
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
    return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function text2(target: Element): string {
    return (target.textContent ?? '').replace(/\s+/g, '');
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
          button.textContent.trim() === label || button.getAttribute('aria-label') === label,
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

  // Envoie le formulaire désigné : l'ajout rapide, ou celui de la fenêtre de modification.
  function submit(selector: string): void {
    element().querySelector(selector)?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => vi.resetAllMocks());

  it('sépare les tâches à faire des tâches faites, masquées par défaut', () => {
    setup([task(1, 'Réviser'), task(2, 'Déjà fait', { done: true })]);

    expect(titles('Sans date')).toEqual(['Réviser']);
    expect(element().querySelector('[aria-label="Tâches faites"]')).toBeNull();
    expect(text('.heading .meta')).toBe('1 à faire');

    click('Faites');

    expect(titles('Tâches faites')).toEqual(['Déjà fait']);
  });

  it('range les tâches par échéance et dit simplement la date', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0);
    const inAMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 9, 0);
    setup([
      task(1, 'Sans échéance'),
      task(2, 'Plus tard', { dueAt: inAMonth.toISOString() }),
      task(3, 'En retard', { dueAt: yesterday.toISOString() }),
    ]);

    expect(Array.from(element().querySelectorAll('h2.group')).map((group) => text2(group))).toEqual(
      ['Enretard1', 'Plustard1', 'Sansdate1'],
    );
    expect(titles('En retard')).toEqual(['En retard']);
    expect(text('.due.is-late')).toBe('Hier 18:00');
    expect(text('.heading .meta')).toBe('3 à faire · 1 en retard');
    expect(element().querySelector('.add-date')?.getAttribute('aria-label')).toBe(
      'Ajouter une date à Sans échéance',
    );
  });

  it('signale les rappels arrivés', () => {
    const past = new Date(Date.now() - HOUR).toISOString();
    const future = new Date(Date.now() + 48 * HOUR).toISOString();
    setup([
      task(1, 'Rendre le rapport', { dueAt: past, remindAt: past }),
      task(2, 'Réviser', { dueAt: future, remindAt: future }),
    ]);

    expect(text('.reminders')).toContain('À faire maintenant');
    expect(text('.reminders')).toContain('Rendre le rapport');
    expect(text('.reminders')).not.toContain('Réviser');
  });

  it('filtre par UE avec les pastilles, y compris les tâches sans UE', () => {
    setup([
      task(1, 'TP systèmes', { ue: { code: 'UTC502', title: 'Systèmes' } }),
      task(2, 'Acheter un cahier'),
    ]);
    expect(titles('Sans date')).toEqual(['TP systèmes', 'Acheter un cahier']);

    click('UTC502');
    expect(titles('Sans date')).toEqual(['TP systèmes']);

    click('Sans UE');
    expect(titles('Sans date')).toEqual(['Acheter un cahier']);

    click('NFE108');
    expect(text()).toContain('Aucune tâche à faire.');
  });

  it('ajoute une tâche en une ligne, dans l’UE filtrée, avec son échéance', () => {
    setup([]);
    service.create.mockReturnValue(of(task(3, 'Réviser')));
    click('UTC502');

    fill('quick-task', ' Réviser ');
    setDate(fixture, '#quick-task-due', '2026-12-15T18:00');
    submit('.quick-add');

    expect(service.create).toHaveBeenCalledWith({
      title: 'Réviser',
      ueCode: 'UTC502',
      dueAt: new Date(2026, 11, 15, 18, 0).toISOString(),
      remindAt: null,
    });
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(element().querySelector<HTMLInputElement>('#quick-task')?.value).toBe('');
  });

  it('n’ajoute rien sans titre et affiche un refus de l’API', () => {
    setup([]);
    submit('.quick-add');
    expect(service.create).not.toHaveBeenCalled();

    service.create.mockReturnValue(
      throwError(() => new ApiError(400, ['L’UE ABC123 n’existe pas.'])),
    );
    fill('quick-task', 'Réviser');
    submit('.quick-add');

    expect(text()).toContain('L’UE ABC123 n’existe pas.');
    expect(element().querySelector<HTMLInputElement>('#quick-task')?.value).toBe('Réviser');
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
    pickOption(fixture, '#task-ue', '');
    submit('app-task-form form');

    expect(service.update).toHaveBeenCalledWith(1, {
      title: 'Réviser le chapitre 3',
      ueCode: null,
      dueAt: null,
      remindAt: null,
    });
  });

  it('supprime une tâche après confirmation seulement', async () => {
    setup([task(1, 'Réviser')]);
    dialog.confirmDeletion.mockResolvedValue(false);
    service.remove.mockReturnValue(of(undefined));

    click('Supprimer la tâche Réviser');
    await settle();
    expect(dialog.confirmDeletion).toHaveBeenCalledOnce();
    expect(service.remove).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    click('Supprimer la tâche Réviser');
    await settle();
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
