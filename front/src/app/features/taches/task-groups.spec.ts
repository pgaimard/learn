import { dueLabel, groupOf, groupTasks } from './task-groups';
import { Task } from './task.service';

// Jeudi 12 novembre 2026, 10:00.
const NOW = new Date(2026, 10, 12, 10, 0);

function task(id: number, due: Date | null): Task {
  return {
    id,
    title: `Tâche ${id}`,
    ue: null,
    dueAt: due?.toISOString() ?? null,
    remindAt: null,
    done: false,
  };
}

describe('groupOf', () => {
  it('range une tâche selon son échéance', () => {
    expect(groupOf(task(1, null), NOW)).toBe('none');
    expect(groupOf(task(2, new Date(2026, 10, 11, 18)), NOW)).toBe('late');
    // Plus tôt le même jour : déjà en retard.
    expect(groupOf(task(3, new Date(2026, 10, 12, 9)), NOW)).toBe('late');
    expect(groupOf(task(4, new Date(2026, 10, 12, 20)), NOW)).toBe('today');
    // Jusqu'au dimanche 15 compris.
    expect(groupOf(task(5, new Date(2026, 10, 15, 23, 59)), NOW)).toBe('week');
    expect(groupOf(task(6, new Date(2026, 10, 16, 0, 0)), NOW)).toBe('later');
  });

  it('un dimanche, la semaine se termine le soir même', () => {
    const sunday = new Date(2026, 10, 15, 10, 0);

    expect(groupOf(task(1, new Date(2026, 10, 15, 20)), sunday)).toBe('today');
    expect(groupOf(task(2, new Date(2026, 10, 16, 9)), sunday)).toBe('later');
  });
});

describe('groupTasks', () => {
  it('rend les groupes non vides dans l’ordre, chacun trié par échéance', () => {
    const groups = groupTasks(
      [
        task(1, null),
        task(2, new Date(2026, 10, 20)),
        task(3, new Date(2026, 10, 14, 12)),
        task(4, new Date(2026, 10, 13, 12)),
        task(5, new Date(2026, 10, 10)),
      ],
      NOW,
    );

    expect(groups.map((group) => [group.label, group.tasks.map((entry) => entry.id)])).toEqual([
      ['En retard', [5]],
      ['Cette semaine', [4, 3]],
      ['Plus tard', [2]],
      ['Sans date', [1]],
    ]);
  });
});

describe('dueLabel', () => {
  const label = (due: Date): string => dueLabel(due.toISOString(), NOW);

  it('nomme les jours voisins', () => {
    expect(label(new Date(2026, 10, 11, 18, 0))).toBe('Hier 18:00');
    expect(label(new Date(2026, 10, 12, 20, 0))).toBe('Aujourd’hui 20:00');
    expect(label(new Date(2026, 10, 13, 9, 0))).toBe('Demain 09:00');
  });

  it('donne le jour et la date pour le reste, l’année si elle diffère', () => {
    expect(label(new Date(2026, 10, 20, 23, 59))).toBe('Ven. 20 nov. 23:59');
    expect(label(new Date(2027, 0, 8, 9, 0))).toBe('Ven. 8 janv. 2027 09:00');
  });

  it('n’affiche pas minuit : la tâche est pour la journée', () => {
    expect(label(new Date(2026, 10, 15, 0, 0))).toBe('Dim. 15 nov.');
    expect(label(new Date(2026, 10, 11, 0, 0))).toBe('Hier');
  });
});
