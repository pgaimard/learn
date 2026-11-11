import { toDisplayedGroups } from './search-groups';
import { SearchResults } from './search.service';

const EMPTY = { total: 0, items: [] };

describe('toDisplayedGroups', () => {
  it('ne garde que les groupes qui ont des résultats', () => {
    expect(
      toDisplayedGroups({ courses: EMPTY, definitions: EMPTY, acronyms: EMPTY, files: EMPTY }),
    ).toEqual([]);
  });

  it('donne à chaque résultat son lien et sa précision', () => {
    const results: SearchResults = {
      courses: {
        total: 34,
        items: [{ id: 7, title: 'La mémoire', ueCode: 'UTC502', excerpt: [] }],
      },
      definitions: {
        total: 1,
        items: [{ id: 2, label: 'Pagination', expandedForm: null, excerpt: [] }],
      },
      acronyms: {
        total: 1,
        items: [{ id: 3, label: 'MMU', expandedForm: 'Memory Management Unit', excerpt: [] }],
      },
      files: EMPTY,
    };

    expect(toDisplayedGroups(results)).toEqual([
      {
        title: 'Cours',
        total: 34,
        results: [
          {
            link: ['/ue', 'UTC502', 'cours', 7],
            title: 'La mémoire',
            detail: 'UTC502',
            excerpt: [],
          },
        ],
      },
      {
        title: 'Dictionnaire',
        total: 1,
        results: [{ link: ['/dictionnaire', 2], title: 'Pagination', detail: null, excerpt: [] }],
      },
      {
        title: 'Glossaire',
        total: 1,
        results: [
          { link: ['/glossaire', 3], title: 'MMU', detail: 'Memory Management Unit', excerpt: [] },
        ],
      },
    ]);
  });

  it('mène un fichier à son dossier dans l’onglet des fichiers', () => {
    const file = { id: 9, name: 'TD3.pdf', ueCode: 'UTC502', excerpt: [] };

    const [group] = toDisplayedGroups({
      courses: EMPTY,
      definitions: EMPTY,
      acronyms: EMPTY,
      files: {
        total: 2,
        items: [
          { ...file, folderId: 4, folderName: 'TD' },
          { ...file, id: 10, folderId: null, folderName: null },
        ],
      },
    });

    expect(group.title).toBe('Fichiers');
    expect(group.results).toEqual([
      {
        link: ['/ue', 'UTC502'],
        queryParams: { onglet: 'fichiers', dossier: 4 },
        title: 'TD3.pdf',
        detail: 'UTC502 › TD',
        excerpt: [],
      },
      {
        link: ['/ue', 'UTC502'],
        queryParams: { onglet: 'fichiers' },
        title: 'TD3.pdf',
        detail: 'UTC502',
        excerpt: [],
      },
    ]);
  });
});
