import { filterTerms } from './filter-terms';

const TERMS = [
  { label: 'Élément', expandedForm: null },
  { label: 'PID', expandedForm: 'Process Identifier' },
  { label: 'Processus', expandedForm: null },
];

function labels(query: string): string[] {
  return filterTerms(TERMS, query).map((term) => term.label);
}

describe('filterTerms', () => {
  it('garde tout quand la saisie est vide', () => {
    expect(labels('  ')).toEqual(['Élément', 'PID', 'Processus']);
  });

  it('ignore la casse et les accents', () => {
    expect(labels('ELEMENT')).toEqual(['Élément']);
    expect(labels('é')).toEqual(['Élément', 'PID', 'Processus']);
  });

  it('cherche aussi dans la forme développée', () => {
    expect(labels('identifier')).toEqual(['PID']);
  });

  it('ne renvoie rien sans correspondance', () => {
    expect(labels('mémoire')).toEqual([]);
  });
});
