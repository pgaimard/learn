import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { TermListPage } from './term-list-page';
import { Term, TermService, TermSummary, TermType } from './term.service';

const PID: TermSummary = {
  id: 1,
  type: 'acronym',
  label: 'PID',
  expandedForm: 'Process Identifier',
  excerpt: 'Numéro d’un processus.',
};
const TLB: TermSummary = {
  id: 2,
  type: 'acronym',
  label: 'TLB',
  expandedForm: 'Translation Lookaside Buffer',
  excerpt: '',
};

describe('TermListPage', () => {
  let fixture: ComponentFixture<TermListPage>;
  const service = {
    list: vi.fn<TermService['list']>(),
    create: vi.fn<TermService['create']>(),
    remove: vi.fn<TermService['remove']>(),
    revision: signal(0),
  };

  // Comme le vrai service, une création réussie fait avancer la révision.
  function acceptCreation(id: number): void {
    service.create.mockImplementation(() => {
      service.revision.update((revision) => revision + 1);
      return of({ id } as Term);
    });
  }

  const dialog = { confirmDeletion: vi.fn<DialogService['confirmDeletion']>() };

  // La modale répond de façon asynchrone : on laisse la réponse arriver.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function setup(type: TermType, terms: TermSummary[]): void {
    vi.resetAllMocks();
    service.list.mockReturnValue(of(terms));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TermService, useValue: service },
        { provide: DialogService, useValue: dialog },
      ],
    });
    fixture = TestBed.createComponent(TermListPage);
    fixture.componentRef.setInput('type', type);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function fill(id: string, value: string): void {
    const field = element().querySelector<HTMLInputElement>(`#${id}`);
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }

  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find((button) => button.textContent.trim() === label)
      ?.click();
    fixture.detectChanges();
  }

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function labels(): string[] {
    return Array.from(element().querySelectorAll('.term-label')).map((label) =>
      (label.textContent ?? '').trim(),
    );
  }

  it('liste les acronymes du glossaire avec un lien vers chacun', () => {
    setup('acronym', [PID, TLB]);

    expect(service.list).toHaveBeenCalledWith({ type: 'acronym' });
    expect(element().querySelector('h1')?.textContent).toBe('Glossaire');
    expect(labels()).toEqual(['PID', 'TLB']);
    expect(element().querySelector('a.term')?.getAttribute('href')).toBe('/glossaire/1');
  });

  it('propose de modifier chaque terme', () => {
    setup('acronym', [PID, TLB]);

    const links = Array.from(element().querySelectorAll('.term-actions a')).map((link) => [
      link.getAttribute('aria-label'),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Modifier PID', '/glossaire/1/edition'],
      ['Modifier TLB', '/glossaire/2/edition'],
    ]);
  });

  it('supprime un terme après confirmation seulement, puis recharge', async () => {
    setup('acronym', [PID, TLB]);
    service.remove.mockReturnValue(of(undefined));
    dialog.confirmDeletion.mockResolvedValue(false);
    const remove = (): void => {
      element().querySelector<HTMLButtonElement>('button[aria-label="Supprimer TLB"]')?.click();
    };

    remove();
    await settle();
    expect(dialog.confirmDeletion).toHaveBeenCalledWith(
      'Supprimer le terme',
      '« TLB » et sa définition seront supprimés définitivement.',
    );
    expect(service.remove).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    remove();
    await settle();
    expect(service.remove).toHaveBeenCalledWith(2);
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('affiche le refus d’une suppression', async () => {
    setup('acronym', [PID]);
    dialog.confirmDeletion.mockResolvedValue(true);
    service.remove.mockReturnValue(throwError(() => new ApiError(404, ['Ce terme n’existe pas.'])));

    element().querySelector<HTMLButtonElement>('button[aria-label="Supprimer PID"]')?.click();
    await settle();

    expect(element().textContent).toContain('Ce terme n’existe pas.');
  });

  it('filtre la liste à la saisie', () => {
    setup('acronym', [PID, TLB]);

    fill('term-filter', 'buffer');

    expect(labels()).toEqual(['TLB']);
    expect(element().querySelector('.count')?.textContent).toContain('1 sur 2');
  });

  it('signale qu’aucun terme ne correspond au filtre', () => {
    setup('acronym', [PID]);

    fill('term-filter', 'xyz');

    expect(element().textContent).toContain('Aucun terme ne correspond à « xyz »');
  });

  it('invite à créer une définition quand le dictionnaire est vide', () => {
    setup('definition', []);

    expect(element().textContent).toContain('Aucune définition pour l’instant.');
    expect(element().querySelector('#term-filter')).toBeNull();
  });

  it('crée une définition avec son texte en premier paragraphe, puis recharge', () => {
    setup('definition', []);
    acceptCreation(3);
    click('Nouvelle définition');

    fill('term-label', ' Processus ');
    fill('term-text', 'Programme en cours d’exécution.');
    submit();

    expect(service.create).toHaveBeenCalledWith({
      type: 'definition',
      label: 'Processus',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Programme en cours d’exécution.' }],
          },
        ],
      },
    });
    fixture.detectChanges();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(element().querySelector('form')).toBeNull();
  });

  it('exige la forme développée d’un acronyme', () => {
    setup('acronym', []);
    click('Nouvel acronyme');

    fill('term-label', 'CPU');
    submit();

    expect(service.create).not.toHaveBeenCalled();
    expect(element().textContent).toContain('La forme développée est requise');

    acceptCreation(4);
    fill('term-expanded-form', 'Central Processing Unit');
    submit();

    expect(service.create).toHaveBeenCalledWith({
      type: 'acronym',
      label: 'CPU',
      expandedForm: 'Central Processing Unit',
    });
  });

  it('affiche le refus de l’API et garde le formulaire ouvert', () => {
    setup('definition', []);
    service.create.mockReturnValue(
      throwError(() => new ApiError(409, ['« Processus » existe déjà dans le dictionnaire.'])),
    );
    click('Nouvelle définition');

    fill('term-label', 'Processus');
    submit();

    expect(element().textContent).toContain('existe déjà dans le dictionnaire');
    expect(element().querySelector('form')).not.toBeNull();
  });
});
