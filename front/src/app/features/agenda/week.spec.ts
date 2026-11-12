import { Task } from '../taches/task.service';
import { AgendaEvent } from './event.service';
import {
  addDays,
  buildWeek,
  formatDay,
  formatWeekParam,
  parseWeekParam,
  startOfWeek,
  weeklyOccurrences,
} from './week';

const TUESDAY = new Date(2026, 10, 17, 15, 30);
const MONDAY = new Date(2026, 10, 16);

function event(id: number, start: Date, end: Date): AgendaEvent {
  return {
    id,
    title: `Événement ${id}`,
    description: '',
    type: 'course',
    ue: null,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

describe('semaine de l’agenda', () => {
  it('commence le lundi à minuit, y compris un dimanche', () => {
    expect(startOfWeek(TUESDAY)).toEqual(MONDAY);
    expect(startOfWeek(new Date(2026, 10, 22, 23, 59))).toEqual(MONDAY);
    expect(startOfWeek(MONDAY)).toEqual(MONDAY);
  });

  it('lit la semaine dans l’adresse et retombe sur la semaine en cours', () => {
    expect(parseWeekParam('2026-11-25', TUESDAY)).toEqual(new Date(2026, 10, 23));
    expect(parseWeekParam(undefined, TUESDAY)).toEqual(MONDAY);
    expect(parseWeekParam('la semaine prochaine', TUESDAY)).toEqual(MONDAY);
    expect(formatWeekParam(MONDAY)).toBe('2026-11-16');
  });

  it('nomme un jour en français', () => {
    expect(formatDay(TUESDAY)).toBe('mardi 17 novembre');
  });

  it('garde l’heure locale en ajoutant des jours à travers un changement d’heure', () => {
    const beforeChange = new Date(2026, 9, 20, 18, 0);

    const after = addDays(beforeChange, 7);

    expect([after.getDate(), after.getHours()]).toEqual([27, 18]);
  });
});

describe('weeklyOccurrences', () => {
  const start = new Date(2026, 9, 13, 18, 0);
  const end = new Date(2026, 9, 13, 21, 0);

  it('ne crée qu’une occurrence sans répétition', () => {
    expect(weeklyOccurrences(start, end, null)).toEqual([
      { startsAt: start.toISOString(), endsAt: end.toISOString() },
    ]);
  });

  it('répète chaque semaine à la même heure locale, jour de fin compris', () => {
    const occurrences = weeklyOccurrences(start, end, new Date(2026, 10, 3));
    const starts = occurrences.map((occurrence) => new Date(occurrence.startsAt));

    expect(starts.map((date) => date.getDate())).toEqual([13, 20, 27, 3]);
    expect(starts.every((date) => date.getHours() === 18)).toBe(true);
    expect(new Date(occurrences[3].endsAt).getHours()).toBe(21);
  });

  it('garde la première occurrence même si la répétition finit avant', () => {
    expect(weeklyOccurrences(start, end, new Date(2026, 8, 1))).toHaveLength(1);
  });

  it('se limite à 60 occurrences', () => {
    expect(weeklyOccurrences(start, end, new Date(2030, 0, 1))).toHaveLength(60);
  });
});

describe('buildWeek', () => {
  it('range événements et tâches par jour et par heure', () => {
    const course = event(1, new Date(2026, 10, 17, 18, 0), new Date(2026, 10, 17, 21, 0));
    const morning = event(2, new Date(2026, 10, 17, 9, 0), new Date(2026, 10, 17, 10, 0));
    const task: Task = {
      id: 5,
      title: 'Rendre le TP',
      ue: null,
      dueAt: new Date(2026, 10, 17, 12, 0).toISOString(),
      remindAt: null,
      done: false,
    };
    const undated: Task = { ...task, id: 6, dueAt: null };

    const week = buildWeek(MONDAY, [course, morning], [task, undated]);

    expect(week).toHaveLength(7);
    expect(week[0].entries).toEqual([]);
    expect(
      week[1].entries.map((entry) => (entry.kind === 'event' ? entry.event.id : entry.task.id)),
    ).toEqual([2, 5, 1]);
  });

  it('montre un événement sur chaque jour qu’il recoupe', () => {
    const exam = event(3, new Date(2026, 10, 18, 22, 0), new Date(2026, 10, 19, 2, 0));

    const week = buildWeek(MONDAY, [exam], []);

    expect(week.map((day) => day.entries.length)).toEqual([0, 0, 1, 1, 0, 0, 0]);
  });
});
