import { Editor } from '@tiptap/core';
import { IconName } from '../../../../core/ui/icon';
import { CALLOUT_KINDS, CALLOUT_LABELS, CalloutKind } from '../../content/callout';

type Chain = ReturnType<Editor['chain']>;

// Bloc proposé par le menu « / ».
export type SlashGroup = 'Titres' | 'Encadrés' | 'Blocs';

export interface SlashCommand {
  label: string;
  // Rubrique sous laquelle le menu le range.
  group: SlashGroup;
  icon: IconName;
  // Autres mots par lesquels on peut le trouver.
  keywords: string[];
  // Transforme le paragraphe courant ou insère le bloc ; absent pour l'image, qui passe
  // par le choix d'un fichier.
  apply?: (chain: Chain) => Chain;
}

export const CALLOUT_ICONS: Record<CalloutKind, IconName> = {
  retenir: 'check',
  change: 'change',
  attention: 'warning',
};

export const IMAGE_COMMAND: SlashCommand = {
  label: 'Image',
  group: 'Blocs',
  icon: 'image',
  keywords: ['figure', 'photo', 'capture', 'schema'],
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    label: 'Section',
    group: 'Titres',
    icon: 'heading',
    keywords: ['titre', 'h2', 'chapitre'],
    apply: (chain) => chain.setHeading({ level: 2 }),
  },
  {
    label: 'Sous-section',
    group: 'Titres',
    icon: 'heading',
    keywords: ['titre', 'h3'],
    apply: (chain) => chain.setHeading({ level: 3 }),
  },
  {
    label: 'Sous-sous-section',
    group: 'Titres',
    icon: 'heading',
    keywords: ['titre', 'h4'],
    apply: (chain) => chain.setHeading({ level: 4 }),
  },
  {
    label: 'Point',
    group: 'Titres',
    icon: 'heading',
    keywords: ['titre', 'h5'],
    apply: (chain) => chain.setHeading({ level: 5 }),
  },
  // Les encadrés portent leur nom, comme dans la barre d'outils : « /retenir », « /attention ».
  ...CALLOUT_KINDS.map((kind): SlashCommand => ({
    label: CALLOUT_LABELS[kind],
    group: 'Encadrés',
    icon: CALLOUT_ICONS[kind],
    keywords: ['encadre', 'bloc', kind],
    apply: (chain) => chain.wrapIn('callout', { kind }),
  })),
  {
    label: 'Liste à puces',
    group: 'Blocs',
    icon: 'list-bullets',
    keywords: ['puce', 'liste'],
    apply: (chain) => chain.toggleBulletList(),
  },
  {
    label: 'Liste numérotée',
    group: 'Blocs',
    icon: 'list-numbers',
    keywords: ['numero', 'liste', 'ordonnee'],
    apply: (chain) => chain.toggleOrderedList(),
  },
  {
    label: 'Citation',
    group: 'Blocs',
    icon: 'quote',
    keywords: ['quote'],
    apply: (chain) => chain.setBlockquote(),
  },
  {
    label: 'Bloc de code',
    group: 'Blocs',
    icon: 'code-block',
    keywords: ['code', 'programme'],
    apply: (chain) => chain.setCodeBlock(),
  },
  {
    label: 'Tableau',
    group: 'Blocs',
    icon: 'table',
    keywords: ['table', 'grille'],
    apply: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
  {
    label: 'Séparateur',
    group: 'Blocs',
    icon: 'rule',
    keywords: ['ligne', 'trait', 'hr'],
    apply: (chain) => chain.setHorizontalRule(),
  },
  IMAGE_COMMAND,
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
