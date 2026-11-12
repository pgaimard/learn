export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
// Rubrique des libellés qui ne commencent pas par une lettre.
export const OTHER_LETTER = '#';

// Lettre sous laquelle un libellé se range : sa première lettre, sans accent, en capitale.
export function letterOf(label: string): string {
  const first = label
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .charAt(0)
    .toUpperCase();
  return ALPHABET.includes(first) ? first : OTHER_LETTER;
}

export interface LetterGroup<T> {
  letter: string;
  terms: T[];
}

// Regroupe par lettre des termes déjà triés par libellé, en gardant leur ordre.
export function groupByLetter<T extends { label: string }>(terms: T[]): LetterGroup<T>[] {
  const groups: LetterGroup<T>[] = [];
  for (const term of terms) {
    const letter = letterOf(term.label);
    const last = groups.at(-1);
    if (last?.letter === letter) {
      last.terms.push(term);
    } else {
      groups.push({ letter, terms: [term] });
    }
  }
  return groups;
}
