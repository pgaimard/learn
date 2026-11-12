import { DropdownOption } from '../../core/ui/dropdown';

// Heures proposées pour un événement : de quart d'heure en quart d'heure, dans la journée.
const STEP = 15;
const LAST = 24 * 60 - STEP;

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// L'heure décalée d'une durée, sans sortir de la journée ni rejoindre l'heure de départ.
export function shiftTime(time: string, minutes: number): string {
  const start = toMinutes(time);
  return toTime(Math.min(Math.max(start + minutes, start + STEP), LAST));
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

// Les quarts d'heure entre deux bornes, avec l'heure en cours si elle n'en est pas un.
function quarters(from: number, to: number, current: string): number[] {
  const steps: number[] = [];
  for (let minutes = Math.ceil(from / STEP) * STEP; minutes <= to; minutes += STEP) {
    steps.push(minutes);
  }
  const kept = current === '' ? -1 : toMinutes(current);
  return kept >= from && kept <= to && !steps.includes(kept)
    ? [...steps, kept].sort((first, second) => first - second)
    : steps;
}

// Débuts possibles : toute la journée, sauf le dernier quart d'heure réservé à la fin.
export function startTimeOptions(current: string): DropdownOption[] {
  return quarters(0, LAST - STEP, current).map((minutes) => ({
    value: toTime(minutes),
    label: toTime(minutes),
  }));
}

// Fins possibles : après le début, chacune avec sa durée (« 19:30 · 1 h »).
export function endTimeOptions(start: string, current: string): DropdownOption[] {
  if (start === '') {
    return [];
  }
  const from = toMinutes(start);
  return quarters(from + 1, LAST, current).map((minutes) => ({
    value: toTime(minutes),
    label: `${toTime(minutes)} · ${duration(minutes - from)}`,
  }));
}
