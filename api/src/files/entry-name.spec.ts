import { isEntryName } from './entry-name.js';

describe('isEntryName', () => {
  it.each([
    'TD',
    'Annales 2024',
    'TD3_processus-corrigé.pdf',
    '.gitignore',
    'a',
  ])('accepte « %s »', (name) => {
    expect(isEntryName(name)).toBe(true);
  });

  it.each([
    ['vide', ''],
    ['fait d’espaces', '   '],
    ['« . »', '.'],
    ['« .. »', '..'],
    ['avec une barre oblique', 'a/b'],
    ['avec une barre oblique inversée', 'a\\b'],
    ['avec un saut de ligne', 'a\nb'],
    ['avec un caractère nul', 'a\u0000b'],
    ['trop long', 'a'.repeat(256)],
  ])('refuse un nom %s', (_label, name) => {
    expect(isEntryName(name)).toBe(false);
  });
});
