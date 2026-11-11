import { BadRequestException } from '@nestjs/common';
import { resolveExpandedForm } from './term-rules.js';

describe('resolveExpandedForm', () => {
  it('garde la forme développée demandée pour un acronyme', () => {
    expect(resolveExpandedForm('acronym', 'Unité centrale', null)).toBe(
      'Unité centrale',
    );
  });

  it('conserve la forme actuelle quand rien n’est demandé', () => {
    expect(resolveExpandedForm('acronym', undefined, 'Unité centrale')).toBe(
      'Unité centrale',
    );
  });

  it.each([
    ['absente', undefined],
    ['vide', ''],
    ['effacée', null],
  ])('refuse un acronyme à la forme développée %s', (_label, requested) => {
    expect(() => resolveExpandedForm('acronym', requested, null)).toThrow(
      BadRequestException,
    );
  });

  it('efface la forme développée d’un terme devenu définition', () => {
    expect(
      resolveExpandedForm('definition', undefined, 'Unité centrale'),
    ).toBeNull();
  });

  it('refuse une forme développée sur une définition', () => {
    expect(() =>
      resolveExpandedForm('definition', 'Unité centrale', null),
    ).toThrow(BadRequestException);
  });
});
