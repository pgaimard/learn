import { parseExcerpt } from './parse-excerpt.js';

describe('parseExcerpt', () => {
  it('sépare les mots trouvés du reste du texte', () => {
    expect(parseExcerpt('Un \u0001processus\u0002 est\nactif.')).toEqual([
      { text: 'Un ', highlighted: false },
      { text: 'processus', highlighted: true },
      { text: ' est actif.', highlighted: false },
    ]);
  });

  it('gère un extrait qui commence et finit par un mot trouvé', () => {
    expect(parseExcerpt('\u0001Mémoire\u0002 et \u0001mémoires\u0002')).toEqual(
      [
        { text: 'Mémoire', highlighted: true },
        { text: ' et ', highlighted: false },
        { text: 'mémoires', highlighted: true },
      ],
    );
  });

  it('laisse le HTML du texte tel quel, comme du texte', () => {
    expect(parseExcerpt('<b>\u0001x\u0002</b>')).toEqual([
      { text: '<b>', highlighted: false },
      { text: 'x', highlighted: true },
      { text: '</b>', highlighted: false },
    ]);
  });

  it('renvoie une liste vide pour un extrait vide', () => {
    expect(parseExcerpt('')).toEqual([]);
  });
});
