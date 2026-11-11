import { Task } from './task.service';

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// Valeur d'un champ <input type="datetime-local"> : la date à l'heure du navigateur.
export function toLocalInput(iso: string | null): string {
  if (iso === null) {
    return '';
  }
  const date = new Date(iso);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// Date ISO 8601 correspondant à un champ datetime-local ; null si le champ est vide ou invalide.
export function fromLocalInput(value: string): string | null {
  const date = new Date(value);
  return value === '' || Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// « mar. 15 déc. 2026, 18:00 »
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

// Tâche à faire dont le moment du rappel est arrivé.
export function isReminderDue(task: Task, now: Date): boolean {
  return !task.done && task.remindAt !== null && new Date(task.remindAt) <= now;
}

// Tâche à faire dont l'échéance est passée.
export function isOverdue(task: Task, now: Date): boolean {
  return !task.done && task.dueAt !== null && new Date(task.dueAt) < now;
}
