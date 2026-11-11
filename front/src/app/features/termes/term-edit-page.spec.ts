import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { UeService } from '../ue/ue.service';
import { TermEditPage } from './term-edit-page';
import { Term, TermService } from './term.service';

const CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numéro d’un processus.' }] }],
};
const PID: Term = {
  id: 7,
  type: 'acronym',
  label: 'PID',
  expandedForm: 'Process Identifier',
  content: CONTENT,
  ue: { code: 'UTC502', title: 'Systèmes' },
  course: { id: 3, title: 'Processus' },
};
const UES = [
  { id: 1, code: 'UTC502', title: 'Systèmes', description: '', position: 1 },
  { id: 2, code: 'NFE108', title: 'Méthodes', description: '', position: 2 },
];

describe('TermEditPage', () => {
  let fixture: ComponentFixture<TermEditPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const service = {
    get: vi.fn<TermService['get']>(),
    update: vi.fn<TermService['update']>(),
    remove: vi.fn<TermService['remove']>(),
    uploadImage: vi.fn<TermService['uploadImage']>(),
  };

  async function setup(term: Term = PID): Promise<void> {
    vi.resetAllMocks();
    service.get.mockReturnValue(of(term));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TermService, useValue: service },
        { provide: UeService, useValue: { list: () => of(UES) } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TermEditPage);
    fixture.componentRef.setInput('id', '7');
    fixture.detectChanges();
    await fixture.whenStable();
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

  function fill(id: string, value: string, event = 'input'): void {
    const field = element().querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event(event));
    }
    fixture.detectChanges();
  }

  it('affiche le terme et sa définition dans l’éditeur', async () => {
    await setup();

    expect(element().querySelector<HTMLInputElement>('#edit-label')?.value).toBe('PID');
    expect(element().querySelector<HTMLSelectElement>('#edit-ue')?.value).toBe('UTC502');
    expect(element().querySelector('.ProseMirror')?.textContent).toContain(
      'Numéro d’un processus.',
    );
    expect(element().textContent).toContain('Issu du cours « Processus »');
  });

  it('enregistre le libellé, la forme développée et la définition sans toucher à l’origine', async () => {
    await setup();
    service.update.mockReturnValue(of({ ...PID, label: 'PPID' }));

    fill('edit-label', ' PPID ');
    expect(element().textContent).toContain('Modifications non enregistrées');
    click('Enregistrer');

    expect(service.update).toHaveBeenCalledWith(7, {
      label: 'PPID',
      expandedForm: 'Process Identifier',
      content: CONTENT,
    });
    expect(element().textContent).toContain('Enregistré à');
  });

  it('détache le terme de son cours quand l’UE d’origine change', async () => {
    await setup();
    service.update.mockReturnValue(of({ ...PID, ue: null, course: null }));

    fill('edit-ue', '', 'change');
    click('Enregistrer');

    expect(service.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ ueCode: null, courseId: null }),
    );
    expect(element().textContent).not.toContain('Issu du cours');
  });

  it('n’envoie pas de forme développée pour une définition', async () => {
    await setup({ ...PID, type: 'definition', expandedForm: null, ue: null, course: null });
    service.update.mockReturnValue(of(PID));

    expect(element().querySelector('#edit-expanded-form')).toBeNull();
    fill('edit-ue', 'NFE108', 'change');
    click('Enregistrer');

    expect(service.update).toHaveBeenCalledWith(7, {
      label: 'PID',
      content: CONTENT,
      ueCode: 'NFE108',
      courseId: null,
    });
  });

  it('refuse un acronyme sans forme développée', async () => {
    await setup();

    fill('edit-expanded-form', '  ');
    click('Enregistrer');

    expect(service.update).not.toHaveBeenCalled();
    expect(element().textContent).toContain('La forme développée est requise');
  });

  it('affiche le refus de l’API et garde les modifications', async () => {
    await setup();
    service.update.mockReturnValue(
      throwError(() => new ApiError(409, ['« TLB » existe déjà dans le glossaire.'])),
    );

    fill('edit-label', 'TLB');
    click('Enregistrer');

    expect(element().textContent).toContain('existe déjà dans le glossaire');
    expect(element().textContent).toContain('Modifications non enregistrées');
  });

  it('envoie une image puis l’insère dans la définition', async () => {
    await setup();
    service.uploadImage.mockReturnValue(of({ id: 5, src: '/api/terms/7/images/5', altText: '' }));
    const file = new File(['x'], 'schema.png', { type: 'image/png' });
    const field = element().querySelector<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(field, 'files', { value: [file] });

    field?.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(service.uploadImage).toHaveBeenCalledWith(7, file);
    expect(element().querySelector('figure img')?.getAttribute('src')).toBe(
      '/api/terms/7/images/5',
    );
  });

  it('supprime le terme après confirmation et revient au glossaire', async () => {
    await setup();
    service.remove.mockReturnValue(of(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    click('Supprimer');

    expect(service.remove).toHaveBeenCalledWith(7);
    expect(navigate).toHaveBeenCalledWith(['/glossaire']);
  });
});
