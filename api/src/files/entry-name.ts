import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';

const MAX_LENGTH = 255;
const DELETE = 127;

function isForbidden(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    character === '/' || character === '\\' || code < 32 || code === DELETE
  );
}

// Nom d'un dossier ou d'un fichier : au moins un caractère visible, ni séparateur de
// chemin, ni caractère de contrôle, ni nom réservé (« . » et « .. »).
export function isEntryName(value: string): boolean {
  return (
    value.trim().length > 0 &&
    value.length <= MAX_LENGTH &&
    value !== '.' &&
    value !== '..' &&
    !Array.from(value).some(isForbidden)
  );
}

export function IsEntryName(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    ValidateBy({
      name: 'isEntryName',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isEntryName(value),
        defaultMessage: () =>
          `Le nom est requis (${MAX_LENGTH} caractères au plus) et ne peut contenir ni « / », ni « \\ », ni caractère de contrôle.`,
      },
    }),
  );
}
