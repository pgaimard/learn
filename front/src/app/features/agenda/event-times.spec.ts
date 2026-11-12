import { endTimeOptions, shiftTime, startTimeOptions } from './event-times';

describe('heures d’un événement', () => {
  it('propose les débuts de quart d’heure en quart d’heure, et l’heure en cours', () => {
    const options = startTimeOptions('18:40').map((option) => option.value);

    expect(options[0]).toBe('00:00');
    expect(options.at(-1)).toBe('23:30');
    expect(options.slice(74, 77)).toEqual(['18:30', '18:40', '18:45']);
    expect(startTimeOptions('18:30')).toHaveLength(95);
  });

  it('ne propose que des fins après le début, avec leur durée', () => {
    const options = endTimeOptions('18:30', '21:30');

    expect(options.slice(0, 3).map((option) => option.label)).toEqual([
      '18:45 · 15 min',
      '19:00 · 30 min',
      '19:15 · 45 min',
    ]);
    expect(options.find((option) => option.value === '21:30')?.label).toBe('21:30 · 3 h');
    expect(options.find((option) => option.value === '20:45')?.label).toBe('20:45 · 2 h 15');
    expect(options.at(-1)?.value).toBe('23:45');
    expect(endTimeOptions('', '')).toEqual([]);
  });

  it('décale une heure sans sortir de la journée', () => {
    expect(shiftTime('18:00', 120)).toBe('20:00');
    expect(shiftTime('23:00', 180)).toBe('23:45');
    // Jamais avant ni à l'heure de départ.
    expect(shiftTime('18:00', 0)).toBe('18:15');
  });
});
