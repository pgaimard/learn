import { buildSearchQuery } from './build-search-query.js';

describe('buildSearchQuery', () => {
  it('exige tous les mots et prend le dernier comme un début de mot', () => {
    expect(buildSearchQuery('Mémoire virtu')).toBe('mémoire & virtu:*');
  });

  it('ne garde que les lettres et les chiffres', () => {
    expect(buildSearchQuery("l'ordonnanceur (CPU) !")).toBe(
      'l & ordonnanceur & cpu:*',
    );
    expect(buildSearchQuery('a | b & !c:* <-> d')).toBe('a & b & c & d:*');
  });

  it('se limite à dix mots', () => {
    expect(buildSearchQuery('a b c d e f g h i j k l')).toBe(
      'a & b & c & d & e & f & g & h & i & j:*',
    );
  });

  it('ne produit rien sans lettre ni chiffre', () => {
    expect(buildSearchQuery(' &|! ')).toBeNull();
  });
});
