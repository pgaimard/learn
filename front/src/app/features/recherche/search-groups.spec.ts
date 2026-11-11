import { toDisplayedGroups } from './search-groups';
import { SearchResults } from './search.service';

const EMPTY = { total: 0, items: [] };

describe('toDisplayedGroups', () => {
  it('ne garde que les groupes qui ont des résultats', () => {
    expect(toDisplayedGroups({ courses: EMPTY, definitions: EMPTY, acronyms: EMPTY })).toEqual([]);
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
});
