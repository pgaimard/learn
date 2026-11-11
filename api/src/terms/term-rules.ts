import { BadRequestException } from '@nestjs/common';
import type { TermType } from './term.entity.js';

// Un acronyme a toujours une forme développée, une définition n'en a jamais.
export function resolveExpandedForm(
  type: TermType,
  requested: string | null | undefined,
  current: string | null,
): string | null {
  if (type === 'definition') {
    if (requested) {
      throw new BadRequestException(
        'Une définition n’a pas de forme développée.',
      );
    }
    return null;
  }
  const expandedForm = requested === undefined ? current : requested;
  if (!expandedForm) {
    throw new BadRequestException(
      'La forme développée est requise pour un acronyme.',
    );
  }
  return expandedForm;
}
