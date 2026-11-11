export interface CourseMetadata {
  ueCode: string;
  title: string;
  position: number;
}

export interface FrontMatterResult {
  metadata: CourseMetadata | null;
  // Corps du Markdown, sans l'en-tête, et nombre de lignes retirées (pour situer les erreurs).
  body: string;
  lineOffset: number;
  errors: string[];
}

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;
const BYTE_ORDER_MARK = 0xfeff;

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

// Lecture volontairement simple : une ligne « clé: valeur » par champ. Un titre peut ainsi
// contenir un deux-points sans guillemets, ce qu'un YAML strict refuserait.
function readFields(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      const key = line.slice(0, separator).trim().toLowerCase();
      fields.set(key, unquote(line.slice(separator + 1).trim()));
    }
  }
  return fields;
}

function buildMetadata(
  fields: Map<string, string>,
  errors: string[],
): CourseMetadata | null {
  const ueCode = (fields.get('ue') ?? '').toUpperCase();
  const title = fields.get('titre') ?? '';
  const position = Number(fields.get('ordre'));
  if (!/^[A-Z0-9]{3,10}$/.test(ueCode)) {
    errors.push(
      'En-tête : le champ « ue » doit contenir le code de l’UE (ex. UTC502).',
    );
  }
  if (title.length === 0 || title.length > 200) {
    errors.push(
      'En-tête : le champ « titre » est requis (200 caractères au plus).',
    );
  }
  if (!fields.has('ordre') || !Number.isInteger(position) || position < 0) {
    errors.push(
      'En-tête : le champ « ordre » doit être un nombre entier positif.',
    );
  }
  return errors.length === 0 ? { ueCode, title, position } : null;
}

export function parseFrontMatter(source: string): FrontMatterResult {
  const markdown =
    source.charCodeAt(0) === BYTE_ORDER_MARK ? source.slice(1) : source;
  const match = FRONT_MATTER.exec(markdown);
  if (!match) {
    return {
      metadata: null,
      body: markdown,
      lineOffset: 0,
      errors: [
        'cours.md doit commencer par un en-tête entre deux lignes « --- » (ue, titre, ordre).',
      ],
    };
  }
  const errors: string[] = [];
  const metadata = buildMetadata(readFields(match[1]), errors);
  return {
    metadata,
    body: markdown.slice(match[0].length),
    lineOffset: match[0].split('\n').length - 1,
    errors,
  };
}
