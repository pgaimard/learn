import { Command } from './command.service';

export interface CommandFilter {
  // Texte cherché dans le nom et la description.
  query: string;
  // Thème voulu ; vide : tous.
  theme: string;
  modeId: number | null;
  variantId: number | null;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Commandes qui répondent à tous les critères. Une commande sans déclinaison vaut pour
// toutes : elle passe le filtre de n'importe laquelle.
export function filterCommands(commands: Command[], filter: CommandFilter): Command[] {
  const query = normalize(filter.query.trim());
  return commands.filter(
    (command) =>
      (query === '' || normalize(`${command.name} ${command.summary}`).includes(query)) &&
      (filter.theme === '' || command.themes.includes(filter.theme)) &&
      (filter.modeId === null || command.modeId === filter.modeId) &&
      (filter.variantId === null ||
        command.variantIds.length === 0 ||
        command.variantIds.includes(filter.variantId)),
  );
}

// Thèmes portés par au moins une commande, par ordre alphabétique.
export function listThemes(commands: Command[]): string[] {
  return [...new Set(commands.flatMap((command) => command.themes))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
}
