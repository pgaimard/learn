import {
  formatLabel,
  formatTyped,
  formatValue,
  monthDays,
  parseTyped,
  parseValue,
  shiftMonths,
  shortcuts,
} from './date-field-values';

describe('valeurs du sélecteur de date', () => {
  it('lit et écrit les valeurs à l’heure locale, avec ou sans heure', () => {
    expect(parseValue('2026-11-17T18:30')).toEqual(new Date(2026, 10, 17, 18, 30));
    expect(parseValue('2026-11-17')).toEqual(new Date(2026, 10, 17));
    expect(parseValue('')).toBeNull();
    expect(parseValue('2026-02-31')).toBeNull();
    expect(formatValue(new Date(2026, 10, 7, 8, 5), true)).toBe('2026-11-07T08:05');
    expect(formatValue(new Date(2026, 10, 7, 8, 5), false)).toBe('2026-11-07');
    expect(formatValue(null, true)).toBe('');
  });

  it('dit la date en clair', () => {
    expect(formatLabel(new Date(2026, 10, 17, 18, 30), true)).toBe('Mar. 17 nov. 2026 · 18:30');
    expect(formatLabel(new Date(2026, 10, 18), false)).toBe('Mer. 18 nov. 2026');
  });

  it('lit une saisie au clavier et refuse une date impossible', () => {
    const current = new Date(2026, 10, 17, 18, 30);

    expect(parseTyped('20/11/2026 23:59', null)).toEqual(new Date(2026, 10, 20, 23, 59));
    expect(parseTyped(' 1/2/2027 8h05 ', null)).toEqual(new Date(2027, 1, 1, 8, 5));
    // Sans heure : celle déjà choisie, sinon 9 h.
    expect(parseTyped('20/11/2026', current)).toEqual(new Date(2026, 10, 20, 18, 30));
    expect(parseTyped('20/11/2026', null)).toEqual(new Date(2026, 10, 20, 9, 0));
    expect(parseTyped('31/02/2026', null)).toBeNull();
    expect(parseTyped('20/11/2026 25:00', null)).toBeNull();
    expect(parseTyped('demain', null)).toBeNull();
    expect(formatTyped(current, true)).toBe('17/11/2026 18:30');
    expect(formatTyped(current, false)).toBe('17/11/2026');
  });

  it('affiche le mois en six semaines, du lundi au dimanche', () => {
    const days = monthDays(new Date(2026, 10, 12));

    expect(days).toHaveLength(42);
    expect(days[0]).toEqual(new Date(2026, 9, 26));
    expect(days[41]).toEqual(new Date(2026, 11, 6));
  });

  it('ramène au dernier jour un mois trop court', () => {
    expect(shiftMonths(new Date(2027, 0, 31), 1)).toEqual(new Date(2027, 1, 28));
    expect(shiftMonths(new Date(2026, 10, 12), -1)).toEqual(new Date(2026, 9, 12));
  });

  it('propose des raccourcis à partir d’aujourd’hui', () => {
    // Jeudi 12 novembre 2026.
    const thursday = shortcuts(new Date(2026, 10, 12, 15, 0));

    expect(thursday.map((shortcut) => [shortcut.label, shortcut.hint])).toEqual([
      ['Aujourd’hui', 'jeu. 12'],
      ['Demain', 'ven. 13'],
      ['Ce week-end', 'sam. 14'],
      ['Lundi prochain', 'lun. 16'],
      ['Dans 1 semaine', 'jeu. 19'],
      ['Dans 1 mois', '12 déc.'],
    ]);
    // Le dimanche, le week-end est le jour même et lundi est le lendemain.
    const sunday = shortcuts(new Date(2026, 10, 15));
    expect(sunday[2].date).toEqual(new Date(2026, 10, 15));
    expect(sunday[3].date).toEqual(new Date(2026, 10, 16));
  });
});
