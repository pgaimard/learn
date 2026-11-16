import { ExcerptSegment, SearchResults } from './search.service';

// Résultats mis sous une forme commune à tous les types, prête à afficher.
export interface DisplayedResult {
  link: (string | number)[];
  // Paramètres d'adresse du lien : onglet et dossier d'un fichier, commande d'un outil.
  queryParams?: Record<string, string | number>;
  title: string;
  // Précision affichée à côté du titre : code de l'UE, forme développée ou dossier.
  detail: string | null;
  excerpt: ExcerptSegment[];
}

export interface DisplayedGroup {
  title: string;
  total: number;
  results: DisplayedResult[];
}

export function toDisplayedGroups(results: SearchResults): DisplayedGroup[] {
  const groups: DisplayedGroup[] = [
    {
      title: 'Cours',
      total: results.courses.total,
      results: results.courses.items.map((course) => ({
        link: ['/ue', course.ueCode, 'cours', course.id],
        title: course.title,
        detail: course.ueCode,
        excerpt: course.excerpt,
      })),
    },
    {
      title: 'Définitions',
      total: results.definitions.total,
      results: results.definitions.items.map((term) => ({
        link: ['/ue', term.ueCode, 'termes', term.id],
        title: term.label,
        detail: term.ueCode,
        excerpt: term.excerpt,
      })),
    },
    {
      title: 'Acronymes',
      total: results.acronyms.total,
      results: results.acronyms.items.map((term) => ({
        link: ['/ue', term.ueCode, 'termes', term.id],
        title: term.label,
        detail: `${term.ueCode} · ${term.expandedForm}`,
        excerpt: term.excerpt,
      })),
    },
    {
      title: 'Fichiers',
      total: results.files.total,
      // Un fichier trouvé ouvre son dossier : le téléchargement se fait depuis la liste.
      results: results.files.items.map((file) => ({
        link: ['/ue', file.ueCode],
        queryParams:
          file.folderId === null
            ? { onglet: 'fichiers' }
            : { onglet: 'fichiers', dossier: file.folderId },
        title: file.name,
        detail: file.folderName === null ? file.ueCode : `${file.ueCode} › ${file.folderName}`,
        excerpt: file.excerpt,
      })),
    },
    {
      title: 'Outils',
      total: results.tools.total,
      results: results.tools.items.map((tool) => ({
        link: ['/outils', tool.id],
        title: tool.name,
        detail: null,
        excerpt: tool.excerpt,
      })),
    },
    {
      title: 'Commandes',
      total: results.commands.total,
      // Une commande trouvée s'ouvre dépliée dans la page de son outil.
      results: results.commands.items.map((command) => ({
        link: ['/outils', command.toolId],
        queryParams: { volet: 'commandes', commande: command.id },
        title: command.name,
        detail: command.toolName,
        excerpt: command.excerpt,
      })),
    },
  ];
  return groups.filter((group) => group.total > 0);
}
