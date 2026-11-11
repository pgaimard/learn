const MAX_WORDS = 10;

// Saisie découpée pour la recherche plein texte. Seuls les lettres et les chiffres sont
// gardés : la syntaxe des requêtes PostgreSQL n'est jamais fournie par l'utilisateur.
export interface SearchQuery {
  // Tous les mots, exigés tels quels (à la racine près) : « a & b & c ».
  whole: string;
  // Tous les mots sauf le dernier ; vide s'il n'y en a qu'un.
  head: string;
  // Dernier mot, peut-être en cours de frappe.
  last: string;
  // Dernier mot pris comme un début de mot : « c:* ».
  prefix: string;
  // Les mots séparés par des espaces.
  text: string;
}

export function buildSearchQuery(input: string): SearchQuery | null {
  const words = (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(
    0,
    MAX_WORDS,
  );
  const last = words.at(-1);
  if (last === undefined) {
    return null;
  }
  return {
    whole: words.join(' & '),
    head: words.slice(0, -1).join(' & '),
    last,
    prefix: `${last}:*`,
    text: words.join(' '),
  };
}
