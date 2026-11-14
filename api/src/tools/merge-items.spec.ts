import { BadRequestException } from '@nestjs/common';
import { mergeItems } from './merge-items.js';

interface Mode {
  id: number;
  name: string;
  position: number;
}

function build(
  existing: Mode | undefined,
  input: { id?: number; name: string },
): Mode {
  return Object.assign(existing ?? ({} as Mode), { name: input.name });
}

describe('mergeItems', () => {
  const current: Mode[] = [
    { id: 1, name: 'Utilisateur', position: 1 },
    { id: 2, name: 'Privilégié', position: 2 },
  ];

  it('met à jour, ajoute, retire et renumérote selon la liste reçue', () => {
    const merged = mergeItems(
      current.map((mode) => ({ ...mode })),
      [{ name: 'Configuration' }, { id: 2, name: 'Privilégié (enable)' }],
      'mode',
      build,
    );

    expect(merged).toEqual([
      { name: 'Configuration', position: 1 },
      { id: 2, name: 'Privilégié (enable)', position: 2 },
    ]);
  });

  it('refuse un numéro qui n’appartient pas à l’outil', () => {
    expect(() =>
      mergeItems(current, [{ id: 9, name: 'Autre' }], 'mode', build),
    ).toThrow(BadRequestException);
  });

  it('refuse deux éléments de même nom, sans tenir compte de la casse', () => {
    expect(() =>
      mergeItems(current, [{ name: 'bash' }, { name: 'Bash' }], 'mode', build),
    ).toThrow(BadRequestException);
  });
});
