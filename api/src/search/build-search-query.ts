const MAX_WORDS = 10;

// Transforme la saisie en requête plein texte : tous les mots sont exigés et le dernier
// est pris comme un début de mot (« proc » trouve « processus »). Seuls les lettres et les
// chiffres sont gardés : la syntaxe des requêtes PostgreSQL n'est jamais fournie par l'utilisateur.
export function buildSearchQuery(input: string): string | null {
  const words = (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(
    0,
    MAX_WORDS,
  );
  if (words.length === 0) {
    return null;
  }
  const last = words.length - 1;
  return words
    .map((word, index) => (index === last ? `${word}:*` : word))
    .join(' & ');
}
