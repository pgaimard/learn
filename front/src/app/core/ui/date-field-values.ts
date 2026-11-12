// Valeurs du sélecteur de date : les mêmes textes que les champs natifs du navigateur,
// « AAAA-MM-JJ » pour une date et « AAAA-MM-JJTHH:MM » pour une date et une heure,
// toujours à l'heure locale.

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const SHORT_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });
const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const FULL_DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

const VALUE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/;
const TYPED = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?$/;
export const DEFAULT_HOUR = 9;
// Durées proposées pour une fin, en minutes après le début.
const DURATIONS = [30, 60, 120, 180, 240];

export interface Shortcut {
  label: string;
  hint: string;
  date: Date;
}

export interface DurationChoice {
  date: Date;
  time: string;
  label: string;
}

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Date valide aux composantes données, ou null (un 31 février n'existe pas).
function build(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date | null {
  const date = new Date(year, month - 1, day, hour, minute);
  const isReal =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    hour < 24 &&
    minute < 60;
  return isReal ? date : null;
}

export function parseValue(value: string): Date | null {
  const parts = VALUE.exec(value);
  if (!parts) {
    return null;
  }
  const [year, month, day, hour, minute] = parts.slice(1).map((part) => Number(part ?? 0));
  return build(year, month, day, hour, minute);
}

export function formatValue(date: Date | null, withTime: boolean): string {
  if (date === null) {
    return '';
  }
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${formatTime(date)}` : day;
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// « Mar. 17 nov. 2026 · 18:30 », ou sans l'heure.
export function formatLabel(date: Date, withTime: boolean): string {
  const day = capitalize(DAY_LABEL.format(date));
  return withTime ? `${day} · ${formatTime(date)}` : day;
}

// « mardi 17 novembre 2026 » : le nom d'un jour du calendrier.
export function formatFullDay(date: Date): string {
  return FULL_DAY.format(date);
}

export function formatMonth(date: Date): string {
  return capitalize(MONTH.format(date));
}

// Texte de la saisie au clavier : « 17/11/2026 18:30 ».
export function formatTyped(date: Date | null, withTime: boolean): string {
  if (date === null) {
    return '';
  }
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return withTime ? `${day} ${formatTime(date)}` : day;
}

// Lit une saisie « JJ/MM/AAAA » ou « JJ/MM/AAAA HH:MM » ; sans heure, celle de fallback.
export function parseTyped(text: string, fallback: Date | null): Date | null {
  const parts = TYPED.exec(text.trim());
  if (!parts) {
    return null;
  }
  const [day, month, year] = parts.slice(1, 4).map(Number);
  const hour = parts[4] === undefined ? (fallback?.getHours() ?? DEFAULT_HOUR) : Number(parts[4]);
  const minute = parts[5] === undefined ? (fallback?.getMinutes() ?? 0) : Number(parts[5]);
  return build(year, month, day, hour, minute);
}

export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Même jour du mois dans un autre mois, ramené à son dernier jour s'il n'existe pas.
export function shiftMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

// Les six semaines, du lundi au dimanche, qui contiennent le mois.
export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const monday = shiftDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => shiftDays(monday, index));
}

// Jours proposés d'un clic, à partir d'aujourd'hui.
export function shortcuts(today: Date): Shortcut[] {
  const weekday = (today.getDay() + 6) % 7;
  const entries: [string, Date][] = [
    ['Aujourd’hui', shiftDays(today, 0)],
    ['Demain', shiftDays(today, 1)],
    // Samedi qui vient ; le jour même pendant le week-end.
    ['Ce week-end', shiftDays(today, weekday >= 5 ? 0 : 5 - weekday)],
    ['Lundi prochain', shiftDays(today, 7 - weekday)],
    ['Dans 1 semaine', shiftDays(today, 7)],
  ];
  const inAMonth = shiftMonths(today, 1);
  return [
    ...entries.map(([label, date]) => ({ label, hint: SHORT_DAY.format(date), date })),
    { label: 'Dans 1 mois', hint: SHORT_DATE.format(inAMonth), date: inAMonth },
  ];
}

// Fins proposées après un début : « 19:00 · 30 min », « 19:30 · 1 h »…
export function durationChoices(start: Date): DurationChoice[] {
  return DURATIONS.map((minutes) => {
    const date = new Date(start.getTime() + minutes * 60_000);
    return {
      date,
      time: formatTime(date),
      label: minutes < 60 ? `${minutes} min` : `${minutes / 60} h`,
    };
  });
}
