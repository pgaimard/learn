function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Garde les termes dont le libellé ou la forme développée contient la saisie,
// sans tenir compte de la casse ni des accents.
export function filterTerms<T extends { label: string; expandedForm: string | null }>(
  terms: T[],
  query: string,
): T[] {
  const needle = normalize(query.trim());
  if (needle.length === 0) {
    return terms;
  }
  return terms.filter(
    (term) =>
      normalize(term.label).includes(needle) || normalize(term.expandedForm ?? '').includes(needle),
  );
}
