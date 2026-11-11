import {
  formatDateTime,
  fromLocalInput,
  isOverdue,
  isReminderDue,
  toLocalInput,
} from './task-dates';
import { Task } from './task.service';

const NOW = new Date(2026, 11, 10, 9, 0);

function task(changes: Partial<Task>): Task {
  return {
    id: 1,
    title: 'Réviser',
    ue: null,
    dueAt: null,
    remindAt: null,
    done: false,
    ...changes,
  };
}

describe('dates des tâches', () => {
  it('convertit une date vers un champ de saisie locale et retour', () => {
    const iso = new Date(2026, 11, 15, 18, 5).toISOString();

    expect(toLocalInput(iso)).toBe('2026-12-15T18:05');
    expect(fromLocalInput('2026-12-15T18:05')).toBe(iso);
  });

  it('traite un champ vide ou invalide comme une absence de date', () => {
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('demain')).toBeNull();
  });

  it('écrit une date en français', () => {
    const text = formatDateTime(new Date(2026, 11, 15, 18, 5).toISOString());

    expect(text).toContain('15 déc. 2026');
    expect(text).toContain('18:05');
  });

  it('rappelle une tâche à faire dont le rappel est arrivé', () => {
    const past = new Date(2026, 11, 10, 8, 0).toISOString();
    const future = new Date(2026, 11, 10, 10, 0).toISOString();

    expect(isReminderDue(task({ remindAt: past }), NOW)).toBe(true);
    expect(isReminderDue(task({ remindAt: future }), NOW)).toBe(false);
    expect(isReminderDue(task({ remindAt: past, done: true }), NOW)).toBe(false);
    expect(isReminderDue(task({}), NOW)).toBe(false);
  });

  it('signale une tâche à faire dont l’échéance est passée', () => {
    const past = new Date(2026, 11, 9, 18, 0).toISOString();

    expect(isOverdue(task({ dueAt: past }), NOW)).toBe(true);
    expect(isOverdue(task({ dueAt: past, done: true }), NOW)).toBe(false);
    expect(isOverdue(task({ dueAt: new Date(2026, 11, 11).toISOString() }), NOW)).toBe(false);
  });
});
