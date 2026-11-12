import {
  AgendaItem,
  addMonths,
  isoWeekNumber,
  itemsOfDay,
  layoutDay,
  monthGrid,
  nowOffset,
  toAgendaItems,
  toneOf,
} from './calendar';

function item(kind: AgendaItem['kind'], start: Date, end: Date = start): AgendaItem {
  return {
    key: `${kind}-${start.getTime()}`,
    kind,
    title: kind,
    start,
    end,
    ueCode: null,
    tone: 'tone-none',
    time: '',
    event: null,
    task: null,
  };
}

const DAY = new Date(2026, 10, 12);
const at = (hour: number, minute = 0): Date => new Date(2026, 10, 12, hour, minute);

describe('monthGrid', () => {
  it('couvre le mois par six semaines, du lundi au dimanche', () => {
    const grid = monthGrid(new Date(2026, 10, 12));

    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual(new Date(2026, 9, 26));
    expect(grid[41]).toEqual(new Date(2026, 11, 6));
    expect(grid.every((day, index) => (day.getDay() + 6) % 7 === index % 7)).toBe(true);
  });
});

describe('addMonths', () => {
  it('rend le premier jour du mois visé, y compris en changeant d’année', () => {
    expect(addMonths(new Date(2026, 10, 30), 1)).toEqual(new Date(2026, 11, 1));
    expect(addMonths(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1));
    expect(addMonths(new Date(2026, 0, 15), -1)).toEqual(new Date(2025, 11, 1));
  });
});

describe('isoWeekNumber', () => {
  it('suit la norme ISO, aux changements d’année compris', () => {
    expect(isoWeekNumber(new Date(2026, 10, 12))).toBe(46);
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeekNumber(new Date(2027, 0, 1))).toBe(53);
    expect(isoWeekNumber(new Date(2024, 11, 30))).toBe(1);
  });
});

describe('toneOf', () => {
  it('donne une couleur par UE, en boucle, et une à part sans UE', () => {
    const codes = ['A', 'B', 'C', 'D', 'E'];

    expect(toneOf('A', codes)).toBe('tone-0');
    expect(toneOf('E', codes)).toBe('tone-0');
    expect(toneOf('C', codes)).toBe('tone-2');
    expect(toneOf(null, codes)).toBe('tone-none');
    expect(toneOf('Z', codes)).toBe('tone-none');
  });
});

describe('toAgendaItems', () => {
  it('réunit cours, échéances et tâches datées, par heure', () => {
    const items = toAgendaItems(
      [
        {
          id: 1,
          title: 'Cours',
          description: '',
          type: 'course',
          ue: { code: 'UTC502', title: '' },
          startsAt: at(18, 30).toISOString(),
          endsAt: at(21, 30).toISOString(),
        },
        {
          id: 2,
          title: 'Rendu',
          description: '',
          type: 'deadline',
          ue: null,
          startsAt: at(12).toISOString(),
          endsAt: at(12).toISOString(),
        },
      ],
      [
        {
          id: 3,
          title: 'Réviser',
          ue: null,
          dueAt: at(9).toISOString(),
          remindAt: null,
          done: false,
        },
        { id: 4, title: 'Sans date', ue: null, dueAt: null, remindAt: null, done: false },
      ],
      ['UTC502'],
    );

    expect(items.map((entry) => [entry.kind, entry.title, entry.time, entry.tone])).toEqual([
      ['task', 'Réviser', '09:00', 'tone-none'],
      ['deadline', 'Rendu', '12:00', 'tone-none'],
      ['course', 'Cours', '18:30 – 21:30', 'tone-0'],
    ]);
  });
});

describe('itemsOfDay', () => {
  it('garde un cours qui recoupe le jour et les moments de ce jour', () => {
    const overnight = item('course', new Date(2026, 10, 11, 22), at(1));
    const deadline = item('deadline', at(23, 59));
    const tomorrow = item('task', new Date(2026, 10, 13, 9));

    expect(itemsOfDay([overnight, deadline, tomorrow], DAY)).toEqual([overnight, deadline]);
  });
});

describe('layoutDay', () => {
  it('place un cours à son heure, à quarante pixels par heure', () => {
    const [block] = layoutDay(DAY, [item('course', at(18, 30), at(21, 30))]);

    expect(block).toMatchObject({ top: 420, height: 120, column: 0, columns: 1 });
  });

  it('donne une demi-heure à un moment précis', () => {
    const [block] = layoutDay(DAY, [item('deadline', at(12))]);

    expect(block).toMatchObject({ top: 160, height: 20 });
  });

  it('ramène dans la plage affichée ce qui en sort', () => {
    const [early, late] = layoutDay(DAY, [item('task', at(6)), item('deadline', at(23, 59))]);

    expect(early).toMatchObject({ top: 0, height: 20 });
    expect(late).toMatchObject({ top: 540, height: 20 });
  });

  it('partage la largeur entre les éléments qui se chevauchent', () => {
    const blocks = layoutDay(DAY, [
      item('course', at(9), at(11)),
      item('course', at(10), at(12)),
      item('course', at(14), at(15)),
    ]);

    expect(blocks.map((block) => [block.column, block.columns])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
});

describe('nowOffset', () => {
  it('donne la hauteur de l’heure courante, ou rien hors de la plage', () => {
    expect(nowOffset(at(11, 6))).toBe(124);
    expect(nowOffset(at(7, 59))).toBeNull();
    expect(nowOffset(at(22, 30))).toBeNull();
  });
});
