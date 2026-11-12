import { groupByLetter, letterOf } from './term-letters';

describe('letterOf', () => {
  it('donne la première lettre, sans accent, en capitale', () => {
    expect(letterOf('élément')).toBe('E');
    expect(letterOf('  pid')).toBe('P');
    expect(letterOf('Œil')).toBe('#');
    expect(letterOf('3DES')).toBe('#');
    expect(letterOf('')).toBe('#');
  });
});

describe('groupByLetter', () => {
  it('regroupe les termes voisins de même lettre, dans l’ordre reçu', () => {
    const terms = ['CO', 'CPU', 'DMA', 'élément', 'ELF'].map((label) => ({ label }));

    expect(
      groupByLetter(terms).map((group) => [group.letter, group.terms.map((term) => term.label)]),
    ).toEqual([
      ['C', ['CO', 'CPU']],
      ['D', ['DMA']],
      ['E', ['élément', 'ELF']],
    ]);
  });

  it('ne rend aucun groupe pour une liste vide', () => {
    expect(groupByLetter([])).toEqual([]);
  });
});
