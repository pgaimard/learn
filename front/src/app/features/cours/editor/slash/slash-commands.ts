import { Editor } from '@tiptap/core';
import { CALLOUT_KINDS, CALLOUT_LABELS } from '../../content/callout';

type Chain = ReturnType<Editor['chain']>;

// Bloc proposé par le menu « / ».
export interface SlashCommand {
  label: string;
  // Autres mots par lesquels on peut le trouver.
  keywords: string[];
  // Transforme le paragraphe courant ou insère le bloc ; absent pour l'image, qui passe
  // par le choix d'un fichier.
  apply?: (chain: Chain) => Chain;
}

export const IMAGE_COMMAND: SlashCommand = {
  label: 'Image',
  keywords: ['figure', 'photo', 'capture', 'schema'],
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    label: 'Section',
    keywords: ['titre', 'h2', 'chapitre'],
    apply: (chain) => chain.setHeading({ level: 2 }),
  },
  {
    label: 'Sous-section',
    keywords: ['titre', 'h3'],
    apply: (chain) => chain.setHeading({ level: 3 }),
  },
  {
    label: 'Sous-sous-section',
    keywords: ['titre', 'h4'],
    apply: (chain) => chain.setHeading({ level: 4 }),
  },
  { label: 'Point', keywords: ['titre', 'h5'], apply: (chain) => chain.setHeading({ level: 5 }) },
  {
    label: 'Liste à puces',
    keywords: ['puce', 'liste'],
    apply: (chain) => chain.toggleBulletList(),
  },
  {
    label: 'Liste numérotée',
    keywords: ['numero', 'liste', 'ordonnee'],
    apply: (chain) => chain.toggleOrderedList(),
  },
  { label: 'Citation', keywords: ['quote'], apply: (chain) => chain.setBlockquote() },
  {
    label: 'Bloc de code',
    keywords: ['code', 'programme'],
    apply: (chain) => chain.setCodeBlock(),
  },
  {
    label: 'Tableau',
    keywords: ['table', 'grille'],
    apply: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
  {
    label: 'Séparateur',
    keywords: ['ligne', 'trait', 'hr'],
    apply: (chain) => chain.setHorizontalRule(),
  },
  IMAGE_COMMAND,
  ...CALLOUT_KINDS.map((kind): SlashCommand => ({
    label: `Encadré « ${CALLOUT_LABELS[kind]} »`,
    keywords: ['encadre', 'bloc', kind],
    apply: (chain) => chain.wrapIn('callout', { kind }),
  })),
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Blocs dont le nom ou un mot-clé contient la saisie, sans tenir compte de la casse
// ni des accents. Ceux dont le nom commence par la saisie viennent en premier.
export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = normalize(query);
  const matching = SLASH_COMMANDS.filter((command) =>
    [command.label, ...command.keywords].some((word) => normalize(word).includes(needle)),
  );
  const startsWith = (command: SlashCommand): boolean =>
    normalize(command.label).startsWith(needle);
  return [...matching.filter(startsWith), ...matching.filter((command) => !startsWith(command))];
}

// Retire le « /mot » saisi, puis applique le bloc choisi.
export function runSlashCommand(
  editor: Editor,
  command: SlashCommand,
  range: { from: number; to: number },
): void {
  const chain = editor.chain().focus().deleteRange(range);
  (command.apply ? command.apply(chain) : chain).run();
}
