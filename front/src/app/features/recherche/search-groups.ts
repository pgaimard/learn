import { ExcerptSegment, SearchResults } from './search.service';

// Résultats mis sous une forme commune aux trois types, prête à afficher.
export interface DisplayedResult {
  link: (string | number)[];
  // Paramètres d'adresse du lien : onglet et dossier d'un fichier.
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
      title: 'Dictionnaire',
      total: results.definitions.total,
      results: results.definitions.items.map((term) => ({
        link: ['/dictionnaire', term.id],
        title: term.label,
        detail: null,
        excerpt: term.excerpt,
      })),
    },
    {
      title: 'Glossaire',
      total: results.acronyms.total,
      results: results.acronyms.items.map((term) => ({
        link: ['/glossaire', term.id],
        title: term.label,
        detail: term.expandedForm,
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
  ];
  return groups.filter((group) => group.total > 0);
}
