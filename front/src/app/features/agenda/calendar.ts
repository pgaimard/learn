import { Task } from '../taches/task.service';
import { AgendaEvent } from './event.service';
import { addDays, formatTime, isSameDay, startOfWeek } from './week';

// Plage horaire de la vue Semaine, et hauteur d'une heure à l'écran.
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;
export const HOUR_PX = 40;
// Un événement ponctuel (échéance, tâche) occupe une demi-heure dans la grille.
const POINT_MINUTES = 30;
const MINUTE_MS = 60 * 1000;
// Nombre de couleurs d'UE avant de revenir à la première.
const TONE_COUNT = 4;

// Ce que le planning affiche : un cours, une échéance ou une tâche datée.
export interface AgendaItem {
  key: string;
  kind: 'course' | 'deadline' | 'task';
  title: string;
  // Description d'un événement ; vide pour une tâche ou un événement sans description.
  description: string;
  start: Date;
  end: Date;
  ueCode: string | null;
  // Classe de couleur : celle de son UE, ou « tone-none » sans UE.
  tone: string;
  // « 18:30 – 21:30 », ou « 23:59 » pour un moment précis.
  time: string;
  event: AgendaEvent | null;
  task: Task | null;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

// Les 42 jours (six semaines, du lundi au dimanche) qui couvrent le mois de la date.
export function monthGrid(date: Date): Date[] {
  const first = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

// Couleur d'une UE : son rang dans la liste des UE, en boucle.
export function toneOf(ueCode: string | null, ueCodes: string[]): string {
  const rank = ueCode === null ? -1 : ueCodes.indexOf(ueCode);
  return rank < 0 ? 'tone-none' : `tone-${rank % TONE_COUNT}`;
}

export function toAgendaItems(
  events: AgendaEvent[],
  tasks: Task[],
  ueCodes: string[],
): AgendaItem[] {
  const fromEvents = events.map((event): AgendaItem => {
    const isDeadline = event.type === 'deadline';
    return {
      key: `event-${event.id}`,
      kind: isDeadline ? 'deadline' : 'course',
      title: event.title,
      description: event.description,
      start: new Date(event.startsAt),
      end: new Date(event.endsAt),
      ueCode: event.ue?.code ?? null,
      tone: toneOf(event.ue?.code ?? null, ueCodes),
      time:
        isDeadline || event.endsAt === event.startsAt
          ? formatTime(event.startsAt)
          : `${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`,
      event,
      task: null,
    };
  });
  const fromTasks = tasks.flatMap((task): AgendaItem[] =>
    task.dueAt === null
      ? []
      : [
          {
            key: `task-${task.id}`,
            kind: 'task',
            title: task.title,
            description: '',
            start: new Date(task.dueAt),
            end: new Date(task.dueAt),
            ueCode: task.ue?.code ?? null,
            tone: toneOf(task.ue?.code ?? null, ueCodes),
            time: formatTime(task.dueAt),
            event: null,
            task,
          },
        ],
  );
  return [...fromEvents, ...fromTasks].sort(
    (first, second) => first.start.getTime() - second.start.getTime(),
  );
}

// Éléments qui tombent un jour donné : un cours qui recoupe le jour, une échéance ou une
// tâche dont le moment est ce jour-là.
export function itemsOfDay(items: AgendaItem[], day: Date): AgendaItem[] {
  const nextDay = addDays(day, 1);
  return items.filter((item) =>
    item.kind === 'course' ? item.start < nextDay && item.end >= day : isSameDay(item.start, day),
  );
}

// Bloc d'un élément dans la colonne d'un jour : position, hauteur, et colonne quand
// plusieurs éléments se chevauchent.
export interface DayBlock {
  item: AgendaItem;
  top: number;
  height: number;
  column: number;
  columns: number;
}

// Place les éléments d'un jour dans la grille horaire. Ce qui dépasse la plage affichée
// est ramené à ses bords ; les éléments qui se chevauchent se partagent la largeur.
export function layoutDay(day: Date, items: AgendaItem[]): DayBlock[] {
  const opening = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    DAY_START_HOUR,
  ).getTime();
  const closing = opening + (DAY_END_HOUR - DAY_START_HOUR) * 60 * MINUTE_MS;
  const minimum = POINT_MINUTES * MINUTE_MS;

  const spans = itemsOfDay(items, day)
    .map((item) => {
      const start = Math.min(Math.max(item.start.getTime(), opening), closing - minimum);
      const end = Math.min(Math.max(item.end.getTime(), start + minimum), closing);
      return { item, start, end, column: 0, columns: 1 };
    })
    .sort((first, second) => first.start - second.start || second.end - first.end);

  // Groupes d'éléments qui se chevauchent de proche en proche : chacun prend la première
  // colonne libre de son groupe.
  let group: typeof spans = [];
  let groupEnd = 0;
  const closeGroup = (): void => {
    const columns = Math.max(0, ...group.map((span) => span.column)) + 1;
    group.forEach((span) => (span.columns = columns));
    group = [];
  };
  for (const span of spans) {
    if (group.length > 0 && span.start >= groupEnd) {
      closeGroup();
    }
    const taken = new Set(group.filter((other) => other.end > span.start).map((o) => o.column));
    while (taken.has(span.column)) {
      span.column += 1;
    }
    group.push(span);
    groupEnd = Math.max(groupEnd, span.end);
  }
  closeGroup();

  const pxPerMs = HOUR_PX / (60 * MINUTE_MS);
  return spans.map(({ item, start, end, column, columns }) => ({
    item,
    top: Math.round((start - opening) * pxPerMs),
    height: Math.round((end - start) * pxPerMs),
    column,
    columns,
  }));
}

// Hauteur, dans la grille, de l'instant donné ; null hors de la plage affichée.
export function nowOffset(now: Date): number | null {
  const hours = now.getHours() + now.getMinutes() / 60;
  return hours < DAY_START_HOUR || hours > DAY_END_HOUR
    ? null
    : Math.round((hours - DAY_START_HOUR) * HOUR_PX);
}
