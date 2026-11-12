import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { SearchPage } from './search-page';
import { SearchResults, SearchService } from './search.service';

const EMPTY = { total: 0, items: [] };
const RESULTS: SearchResults = {
  courses: {
    total: 25,
    items: [
      {
        id: 7,
        title: 'La mémoire virtuelle',
        ueCode: 'UTC502',
        excerpt: [
          { text: 'Les <b>', highlighted: false },
          { text: 'mémoires', highlighted: true },
        ],
      },
    ],
  },
  definitions: EMPTY,
  acronyms: {
    total: 1,
    items: [{ id: 3, label: 'MMU', expandedForm: 'Memory Management Unit', excerpt: [] }],
  },
  files: {
    total: 1,
    items: [
      { id: 9, name: 'mémoire.pdf', ueCode: 'UTC502', folderId: 4, folderName: 'TD', excerpt: [] },
    ],
  },
};

describe('SearchPage', () => {
  let fixture: ComponentFixture<SearchPage>;
  const service = { search: vi.fn<SearchService['search']>() };

  function setup(query?: string): void {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SearchService, useValue: service }],
    });
    fixture = TestBed.createComponent(SearchPage);
    show(query);
  }

  function show(query?: string): void {
    fixture.componentRef.setInput('q', query);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  function text(): string {
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  }

  beforeEach(() => vi.resetAllMocks());

  it('invite à saisir une recherche quand elle est absente ou trop courte', () => {
    setup(' m ');

    expect(service.search).not.toHaveBeenCalled();
    expect(text()).toContain('Saisissez au moins deux caractères');
  });

  it('affiche les résultats par groupe, avec liens et extrait surligné', () => {
    service.search.mockReturnValue(of(RESULTS));
    setup(' mémoire ');
    const element = fixture.nativeElement as HTMLElement;

    expect(service.search).toHaveBeenCalledWith('mémoire');
    expect(text()).toContain('27 résultats pour « mémoire »');
    expect(
      Array.from(element.querySelectorAll('h2')).map((title) => [
        title.firstChild?.textContent?.trim(),
        title.querySelector('.count')?.textContent,
      ]),
    ).toEqual([
      ['Cours', '25'],
      ['Glossaire', '1'],
      ['Fichiers', '1'],
    ]);
    expect(
      Array.from(element.querySelectorAll('a.result')).map((link) => link.getAttribute('href')),
    ).toEqual(['/ue/UTC502/cours/7', '/glossaire/3', '/ue/UTC502?onglet=fichiers&dossier=4']);
    expect(element.querySelector('mark')?.textContent).toBe('mémoires');
    expect(text()).toContain('Les 1 résultats les plus pertinents sur 25');
  });

  it('affiche le texte d’un extrait sans l’interpréter comme du HTML', () => {
    service.search.mockReturnValue(of(RESULTS));
    setup('mémoire');
    const excerpt = (fixture.nativeElement as HTMLElement).querySelector('.result-excerpt');

    expect(excerpt?.querySelector('b')).toBeNull();
    expect(excerpt?.textContent).toContain('Les <b>');
  });

  it('ramène à la page quittée pour chercher', () => {
    service.search.mockReturnValue(of(RESULTS));
    setup('mémoire');
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')?.click();

    expect(back).toHaveBeenCalled();
  });

  it('annonce une recherche sans résultat', () => {
    service.search.mockReturnValue(
      of({ courses: EMPTY, definitions: EMPTY, acronyms: EMPTY, files: EMPTY }),
    );
    setup('xyz');

    expect(text()).toContain('Aucun résultat pour « xyz ».');
  });

  it('n’affiche que la réponse à la dernière recherche', () => {
    const first = new Subject<SearchResults>();
    service.search.mockReturnValueOnce(first).mockReturnValueOnce(of(RESULTS));
    setup('mém');
    expect(text()).toContain('Recherche en cours');

    show('mémoire');
    first.next({ courses: EMPTY, definitions: EMPTY, acronyms: EMPTY, files: EMPTY });
    fixture.detectChanges();

    expect(text()).toContain('27 résultats pour « mémoire »');
  });

  it('affiche le refus de l’API', () => {
    service.search.mockReturnValue(
      throwError(() => new ApiError(400, ['La recherche ne doit pas dépasser 100 caractères.'])),
    );
    setup('mémoire');

    expect(text()).toContain('La recherche ne doit pas dépasser 100 caractères.');
    expect(text()).not.toContain('Recherche en cours');
  });
});
