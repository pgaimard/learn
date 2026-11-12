import { Task } from './task.service';

export type TaskGroupKey = 'late' | 'today' | 'week' | 'later' | 'none';

export interface TaskGroup {
  key: TaskGroupKey;
  label: string;
  tasks: Task[];
}

const GROUP_LABELS: Record<TaskGroupKey, string> = {
  late: 'En retard',
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  later: 'Plus tard',
  none: 'Sans date',
};
const GROUP_ORDER: TaskGroupKey[] = ['late', 'today', 'week', 'later', 'none'];

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const DAY_WITH_YEAR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Groupe d'une tâche à faire, selon son échéance : passée, aujourd'hui, d'ici dimanche,
// plus tard, ou sans date.
export function groupOf(task: Task, now: Date): TaskGroupKey {
  if (task.dueAt === null) {
    return 'none';
  }
  const due = new Date(task.dueAt);
  const today = startOfDay(now);
  // Lundi suivant, 00:00 : fin de la semaine en cours.
  const nextMonday = addDays(today, 7 - ((today.getDay() + 6) % 7));
  if (due < now) {
    return 'late';
  }
  if (due < addDays(today, 1)) {
    return 'today';
  }
  return due < nextMonday ? 'week' : 'later';
}

// Tâches à faire rangées par échéance ; les groupes vides sont omis. Dans un groupe, les
// échéances les plus proches viennent d'abord.
export function groupTasks(tasks: Task[], now: Date): TaskGroup[] {
  const byGroup = new Map<TaskGroupKey, Task[]>();
  for (const task of tasks) {
    const key = groupOf(task, now);
    byGroup.set(key, [...(byGroup.get(key) ?? []), task]);
  }
  return GROUP_ORDER.flatMap((key) => {
    const group = byGroup.get(key);
    return group
      ? [
          {
            key,
            label: GROUP_LABELS[key],
            tasks: [...group].sort((first, second) =>
              (first.dueAt ?? '').localeCompare(second.dueAt ?? ''),
            ),
          },
        ]
      : [];
  });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Échéance dite simplement : « Hier », « Aujourd’hui 20:00 », « Demain 09:00 »,
// « Ven. 13 nov. 23:59 ». Minuit n'est pas affiché : la tâche est pour la journée.
export function dueLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const names: Record<number, string> = { [-1]: 'Hier', 0: 'Aujourd’hui', 1: 'Demain' };
  const day =
    names[days] ??
    capitalize((due.getFullYear() === now.getFullYear() ? DAY : DAY_WITH_YEAR).format(due));
  const isMidnight = due.getHours() === 0 && due.getMinutes() === 0;
  return isMidnight ? day : `${day} ${TIME.format(due)}`;
}
