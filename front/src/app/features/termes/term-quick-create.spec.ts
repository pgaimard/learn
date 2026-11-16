import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { TermQuickCreate } from './term-quick-create';
import { Term, TermService } from './term.service';

describe('TermQuickCreate', () => {
  let fixture: ComponentFixture<TermQuickCreate>;
  const service = { create: vi.fn<TermService['create']>() };

  function setup(): void {
    vi.resetAllMocks();
    // jsdom n'ouvre pas les boîtes de dialogue : seul l'appel compte ici.
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.dispatchEvent(new Event('close'));
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TermService, useValue: service }],
    });
    fixture = TestBed.createComponent(TermQuickCreate);
    fixture.componentRef.setInput('ueCode', 'UTC502');
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  // Un bouton se désigne par son nom accessible : aria-label s'il en a un, sinon son texte.
  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find((button) => (button.getAttribute('aria-label') ?? button.textContent.trim()) === label)
      ?.click();
    fixture.detectChanges();
  }

  function fill(id: string, value: string): void {
    const field = element().querySelector<HTMLInputElement>(`#${id}`);
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  const UE = { code: 'UTC502', title: 'Systèmes' };

  it('n’affiche le formulaire qu’une fois la boîte ouverte', () => {
    setup();
    expect(element().querySelector('form')).toBeNull();

    click('Nouveau terme');

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(element().querySelector('form')).not.toBeNull();
  });

  it('crée un acronyme dans l’UE, puis propose de l’enrichir', () => {
    setup();
    service.create.mockReturnValue(of({ id: 5, type: 'acronym', label: 'PID', ue: UE } as Term));
    click('Nouveau terme');

    click('Acronyme');
    fill('quick-term-label', 'PID');
    fill('quick-term-expanded-form', 'Process Identifier');
    submit();

    expect(service.create).toHaveBeenCalledWith({
      type: 'acronym',
      label: 'PID',
      expandedForm: 'Process Identifier',
      ueCode: 'UTC502',
    });
    expect(element().textContent).toContain('« PID » est ajouté aux termes de UTC502.');
    expect(element().querySelector('a.button')?.getAttribute('href')).toBe(
      '/ue/UTC502/termes/5/edition',
    );
  });

  it('enchaîne sur un autre terme de la même UE', () => {
    setup();
    service.create.mockReturnValue(
      of({ id: 6, type: 'definition', label: 'Processus', ue: UE } as Term),
    );
    click('Nouveau terme');
    fill('quick-term-label', 'Processus');
    submit();

    click('En créer un autre');
    fill('quick-term-label', 'Fil');
    submit();

    expect(service.create).toHaveBeenLastCalledWith({
      type: 'definition',
      label: 'Fil',
      ueCode: 'UTC502',
    });
  });

  it('affiche le refus de l’API et garde la saisie', () => {
    setup();
    service.create.mockReturnValue(
      throwError(
        () => new ApiError(409, ['« Processus » existe déjà dans les définitions de cette UE.']),
      ),
    );
    click('Nouveau terme');

    fill('quick-term-label', 'Processus');
    submit();

    expect(element().textContent).toContain('existe déjà dans les définitions');
    expect(element().querySelector<HTMLInputElement>('#quick-term-label')?.value).toBe('Processus');
  });

  it('retire le formulaire à la fermeture', () => {
    setup();
    click('Nouveau terme');

    click('Annuler');

    expect(element().querySelector('form')).toBeNull();
  });
});
