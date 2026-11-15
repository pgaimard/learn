// Morceau d'une ligne de commande, avec ce qu'il est pour la coloration.
export type CommandTokenKind =
  'name' | 'option' | 'placeholder' | 'string' | 'punctuation' | 'text';

export interface CommandToken {
  kind: CommandTokenKind;
  text: string;
}

// Dans l'ordre : espaces, texte entre guillemets, <valeur à fournir>, enchaînements,
// crochets et accolades, mot.
const TOKEN =
  /(\s+)|("[^"]*"|'[^']*')|(<[^<>\s][^<>]*>)|(&&|\|\||>>|[|;&>])|([[\]{}])|([^\s"'<>[\]{}|;&]+)/gy;

const OPENING = new Set(['[', '{']);
// Après un de ces signes, hors crochets, une nouvelle commande commence.
const CHAINING = new Set(['|', '||', '&&', ';']);

// Découpe une ligne de commande pour la colorer : le nom de la commande, ses options
// (-c, --count), les valeurs à fournir (<hôte>), les textes entre guillemets.
// name : nom de la commande quand il tient en plusieurs mots (« show ip route »).
// isFragment : la ligne est un morceau de commande (une option), sans nom en tête.
export function highlightCommand(
  line: string,
  { name = '', isFragment = false }: { name?: string; isFragment?: boolean } = {},
): CommandToken[] {
  const tokens: CommandToken[] = [];
  let position = 0;
  let depth = 0;
  let expectsName = !isFragment;
  const lead = leadingName(line, name);
  if (expectsName && lead > 0) {
    tokens.push({ kind: 'name', text: line.slice(0, lead) });
    position = lead;
    expectsName = false;
  }
  TOKEN.lastIndex = position;
  for (let match = TOKEN.exec(line); match; match = TOKEN.exec(line)) {
    const [text, space, quoted, placeholder, chaining, bracket] = match;
    if (space) {
      tokens.push({ kind: 'text', text });
    } else if (quoted) {
      tokens.push({ kind: 'string', text });
    } else if (placeholder) {
      tokens.push({ kind: 'placeholder', text });
    } else if (chaining) {
      tokens.push({ kind: 'punctuation', text });
      expectsName = depth === 0 && CHAINING.has(text);
    } else if (bracket) {
      tokens.push({ kind: 'punctuation', text });
      depth = Math.max(0, depth + (OPENING.has(text) ? 1 : -1));
    } else {
      tokens.push({ kind: wordKind(text, expectsName), text });
      expectsName = false;
    }
    position = TOKEN.lastIndex;
  }
  // Ce que le découpage ne reconnaît pas (un guillemet seul) reste tel quel.
  if (position < line.length) {
    tokens.push({ kind: 'text', text: line.slice(position) });
  }
  return tokens;
}

function wordKind(word: string, expectsName: boolean): CommandTokenKind {
  if (expectsName) {
    return 'name';
  }
  return /^--?[^\s-]/.test(word) ? 'option' : 'text';
}

// Longueur du nom en tête de ligne, s'il y est en entier ; 0 sinon.
function leadingName(line: string, name: string): number {
  const startsWithName =
    name !== '' &&
    line.toLowerCase().startsWith(name.toLowerCase()) &&
    /^(\s|$)/.test(line.slice(name.length));
  return startsWithName ? name.length : 0;
}
