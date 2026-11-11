import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { TermQuickCreate } from './term-quick-create';
import { Term, TermService } from './term.service';

describe('TermQuickCreate', () => {
  let fixture: ComponentFixture<TermQuickCreate>;
  const service = { create: vi.fn<TermService['create']>() };

  function setup(url: string): void {
    vi.resetAllMocks();
    // jsdom n'ouvre pas les boîtes de dialogue : seul l'appel compte ici.
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.dispatchEvent(new Event('close'));
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TermService, useValue: service }],
    });
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(url);
    fixture = TestBed.createComponent(TermQuickCreate);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find((button) => button.textContent.trim() === label)
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

  function check(selector: string): void {
    const field = element().querySelector<HTMLInputElement>(selector);
    field?.click();
    fixture.detectChanges();
  }

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('n’affiche le formulaire qu’une fois la boîte ouverte', () => {
    setup('/');
    expect(element().querySelector('form')).toBeNull();

    click('Nouveau terme');

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(element().querySelector('form')).not.toBeNull();
    expect(element().textContent).not.toContain('Rattacher à');
  });

  it('crée un acronyme rattaché au cours affiché, puis propose de l’enrichir', () => {
    setup('/ue/UTC502/cours/12');
    service.create.mockReturnValue(of({ id: 5, type: 'acronym', label: 'PID' } as Term));
    click('Nouveau terme');

    check('input[type="radio"]:not(:checked)');
    fill('quick-term-label', 'PID');
    fill('quick-term-expanded-form', 'Process Identifier');
    submit();

    expect(service.create).toHaveBeenCalledWith({
      type: 'acronym',
      label: 'PID',
      expandedForm: 'Process Identifier',
      courseId: 12,
    });
    expect(element().textContent).toContain('« PID » est ajouté au glossaire.');
    expect(element().querySelector('a.button')?.getAttribute('href')).toBe('/glossaire/5/edition');
  });

  it('rattache à l’UE affichée, sauf si la case est décochée', () => {
    setup('/ue/UTC502');
    service.create.mockReturnValue(of({ id: 6, type: 'definition', label: 'Processus' } as Term));
    click('Nouveau terme');
    fill('quick-term-label', 'Processus');
    submit();
    expect(service.create).toHaveBeenLastCalledWith({
      type: 'definition',
      label: 'Processus',
      ueCode: 'UTC502',
    });

    click('En créer un autre');
    check('input[type="checkbox"]');
    fill('quick-term-label', 'Fil');
    submit();

    expect(service.create).toHaveBeenLastCalledWith({ type: 'definition', label: 'Fil' });
  });

  it('affiche le refus de l’API et garde la saisie', () => {
    setup('/');
    service.create.mockReturnValue(
      throwError(() => new ApiError(409, ['« Processus » existe déjà dans le dictionnaire.'])),
    );
    click('Nouveau terme');

    fill('quick-term-label', 'Processus');
    submit();

    expect(element().textContent).toContain('existe déjà dans le dictionnaire');
    expect(element().querySelector<HTMLInputElement>('#quick-term-label')?.value).toBe('Processus');
  });

  it('retire le formulaire à la fermeture', () => {
    setup('/');
    click('Nouveau terme');

    click('Annuler');

    expect(element().querySelector('form')).toBeNull();
  });
});
