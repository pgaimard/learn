import { Task } from '../taches/task.service';
import { AgendaEvent, Occurrence } from './event.service';

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const TIME_LABEL = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const WEEK_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_OCCURRENCES = 60;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// Même heure locale, n jours plus tard : setDate tient compte des changements d'heure.
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Lundi 00:00, heure locale, de la semaine qui contient la date.
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(start, -((start.getDay() + 6) % 7));
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

// Semaine désignée par le paramètre d'adresse ?semaine=AAAA-MM-JJ ; la semaine en cours
// si le paramètre est absent ou invalide.
export function parseWeekParam(value: string | undefined, today: Date): Date {
  const match = WEEK_PARAM.exec(value ?? '');
  if (!match) {
    return startOfWeek(today);
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return startOfWeek(Number.isNaN(date.getTime()) ? today : date);
}

export function formatWeekParam(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// « mardi 17 novembre »
export function formatDay(date: Date): string {
  return DAY_LABEL.format(date);
}

// « 18:00 »
export function formatTime(iso: string): string {
  return TIME_LABEL.format(new Date(iso));
}

export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

// Occurrences d'un événement répété chaque semaine, à la même heure locale, jusqu'au jour
// indiqué compris. Sans date de fin de répétition : une seule occurrence.
export function weeklyOccurrences(start: Date, end: Date, until: Date | null): Occurrence[] {
  const lastDay = until
    ? addDays(new Date(until.getFullYear(), until.getMonth(), until.getDate()), 1)
    : null;
  const occurrences: Occurrence[] = [];
  for (let week = 0; occurrences.length < MAX_OCCURRENCES; week++) {
    const startsAt = addDays(start, 7 * week);
    if (week > 0 && (lastDay === null || startsAt >= lastDay)) {
      break;
    }
    occurrences.push({
      startsAt: startsAt.toISOString(),
      endsAt: addDays(end, 7 * week).toISOString(),
    });
  }
  return occurrences;
}

export type DayEntry =
  { kind: 'event'; time: string; event: AgendaEvent } | { kind: 'task'; time: string; task: Task };

export interface AgendaDay {
  date: Date;
  entries: DayEntry[];
}

// Ce qui se passe chaque jour de la semaine, par heure : les événements qui recoupent le
// jour et les tâches dont l'échéance y tombe.
export function buildWeek(weekStart: Date, events: AgendaEvent[], tasks: Task[]): AgendaDay[] {
  return weekDays(weekStart).map((date) => {
    const nextDay = addDays(date, 1);
    const entries: DayEntry[] = [
      ...events
        .filter((event) => new Date(event.startsAt) < nextDay && new Date(event.endsAt) >= date)
        .map((event): DayEntry => ({ kind: 'event', time: event.startsAt, event })),
      ...tasks
        .filter((task) => task.dueAt !== null && isSameDay(new Date(task.dueAt), date))
        .map((task): DayEntry => ({ kind: 'task', time: task.dueAt ?? '', task })),
    ];
    entries.sort((first, second) => first.time.localeCompare(second.time));
    return { date, entries };
  });
}
