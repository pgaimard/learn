import { buildSearchQuery } from './build-search-query.js';

describe('buildSearchQuery', () => {
  it('sépare les mots exigés du dernier, pris aussi comme un début de mot', () => {
    expect(buildSearchQuery('Mémoire virtu')).toEqual({
      whole: 'mémoire & virtu',
      head: 'mémoire',
      last: 'virtu',
      prefix: 'virtu:*',
      text: 'mémoire virtu',
    });
  });

  it('n’a pas de mots de tête pour un mot seul', () => {
    expect(buildSearchQuery('notes')).toMatchObject({
      whole: 'notes',
      head: '',
      prefix: 'notes:*',
    });
  });

  it('ne garde que les lettres et les chiffres', () => {
    expect(buildSearchQuery("l'ordonnanceur (CPU) !")?.whole).toBe(
      'l & ordonnanceur & cpu',
    );
    expect(buildSearchQuery('a | b & !c:* <-> d')).toMatchObject({
      whole: 'a & b & c & d',
      prefix: 'd:*',
    });
  });

  it('se limite à dix mots', () => {
    expect(buildSearchQuery('a b c d e f g h i j k l')?.text).toBe(
      'a b c d e f g h i j',
    );
  });

  it('ne produit rien sans lettre ni chiffre', () => {
    expect(buildSearchQuery(' &|! ')).toBeNull();
  });
});
