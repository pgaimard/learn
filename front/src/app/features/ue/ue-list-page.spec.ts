import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { AgendaEvent, EventService } from '../agenda/event.service';
import { TaskService } from '../taches/task.service';
import { UeListPage } from './ue-list-page';
import { Ue, UeService } from './ue.service';

const UTC502: Ue = { id: 1, code: 'UTC502', title: 'Systèmes', description: '', position: 1 };

describe('UeListPage', () => {
  let fixture: ComponentFixture<UeListPage>;
  const service = {
    list: vi.fn<UeService['list']>(),
    create: vi.fn<UeService['create']>(),
    update: vi.fn<UeService['update']>(),
    remove: vi.fn<UeService['remove']>(),
    reorder: vi.fn<UeService['reorder']>(),
  };
  const dialog = {
    confirm: vi.fn<DialogService['confirm']>(),
    confirmDeletion: vi.fn<DialogService['confirmDeletion']>(),
  };

  // La modale répond de façon asynchrone : on laisse la réponse arriver.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function setup(ues: Ue[], events: AgendaEvent[] = []): void {
    vi.resetAllMocks();
    service.list.mockReturnValue(of(ues));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: dialog },
        { provide: UeService, useValue: service },
        { provide: EventService, useValue: { list: () => of(events) } },
        { provide: TaskService, useValue: { list: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(UeListPage);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(label: string): void {
    const button = Array.from(element().querySelectorAll('button')).find(
      (candidate) =>
        (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === label,
    );
    button?.click();
    fixture.detectChanges();
  }

  function fillAndSubmit(code: string, title: string): void {
    const fill = (id: string, value: string): void => {
      const field = element().querySelector<HTMLInputElement>(`#${id}`);
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event('input'));
      }
    };
    fill('ue-code', code);
    fill('ue-title', title);
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('affiche les UE reçues de l’API', () => {
    setup([UTC502]);

    expect(element().textContent).toContain('UTC502');
    expect(element().textContent).toContain('Systèmes');
  });

  const NFE108: Ue = { id: 2, code: 'NFE108', title: 'Méthodes', description: '', position: 2 };

  function codes(): string[] {
    return Array.from(element().querySelectorAll('.ue .code-chip')).map((code) =>
      (code.textContent ?? '').trim(),
    );
  }

  function pressOnHandle(index: number, key: string): void {
    const handle = element().querySelectorAll('.sort-handle').item(index);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  }

  it('réordonne les UE depuis la poignée et enregistre le nouvel ordre', () => {
    setup([UTC502, NFE108]);
    service.reorder.mockReturnValue(of([NFE108, UTC502]));

    pressOnHandle(0, 'ArrowDown');

    expect(codes()).toEqual(['NFE108', 'UTC502']);
    expect(service.reorder).toHaveBeenCalledWith(['NFE108', 'UTC502']);
  });

  it('n’enregistre rien pour un déplacement hors de la liste', () => {
    setup([UTC502, NFE108]);

    pressOnHandle(0, 'ArrowUp');

    expect(service.reorder).not.toHaveBeenCalled();
    expect(codes()).toEqual(['UTC502', 'NFE108']);
  });

  it('revient à l’ordre enregistré quand l’API refuse', () => {
    setup([UTC502, NFE108]);
    service.reorder.mockReturnValue(
      throwError(() => new ApiError(400, ['L’ordre doit contenir toutes les UE.'])),
    );

    pressOnHandle(1, 'ArrowUp');

    expect(element().textContent).toContain('L’ordre doit contenir toutes les UE.');
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(codes()).toEqual(['UTC502', 'NFE108']);
  });

  it('affiche les compteurs de chaque UE', () => {
    setup([{ ...UTC502, counts: { courses: 1, terms: 12, files: 0 } }]);

    expect(
      Array.from(element().querySelectorAll('.ue-counts .pill')).map((pill) => pill.textContent),
    ).toEqual(['1 cours', '12 termes', '0 fichier']);
  });

  it('liste ce qui est prévu cette semaine, ou le dit quand il n’y a rien', () => {
    const today = new Date();
    today.setHours(18, 30, 0, 0);
    setup(
      [UTC502],
      [
        {
          id: 1,
          title: 'Cours systèmes',
          type: 'course',
          ue: { code: 'UTC502', title: 'Systèmes' },
          startsAt: today.toISOString(),
          endsAt: today.toISOString(),
        },
      ],
    );

    const row = element().querySelector('.week .list-row');
    expect(row?.textContent).toContain('18:30');
    expect(row?.textContent).toContain('Cours systèmes');
    expect(row?.querySelector('.code-chip')?.textContent).toBe('UTC502');

    TestBed.resetTestingModule();
    setup([UTC502]);
    expect(element().querySelector('.week')?.textContent).toContain('Rien de prévu cette semaine.');
  });

  it('invite à créer une UE quand il n’y en a aucune', () => {
    setup([]);

    expect(element().textContent).toContain('Aucune UE pour l’instant');
  });

  it('crée une UE puis recharge la liste', () => {
    setup([]);
    service.create.mockReturnValue(of(UTC502));
    click('Nouvelle UE');

    fillAndSubmit('utc502', 'Systèmes');

    expect(service.create).toHaveBeenCalledWith({
      code: 'UTC502',
      title: 'Systèmes',
      description: '',
    });
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(element().querySelector('form')).toBeNull();
  });

  it('garde le formulaire ouvert et affiche le message quand l’API refuse', () => {
    setup([]);
    service.create.mockReturnValue(
      throwError(() => new ApiError(409, ['Une UE porte déjà le code UTC502.'])),
    );
    click('Nouvelle UE');

    fillAndSubmit('UTC502', 'Doublon');

    expect(element().textContent).toContain('Une UE porte déjà le code UTC502.');
    expect(element().querySelector('form')).not.toBeNull();
  });

  it('modifie l’UE désignée par son code d’origine', () => {
    setup([UTC502]);
    service.update.mockReturnValue(of(UTC502));
    click('Modifier l’UE UTC502');

    fillAndSubmit('UTC503', 'Systèmes');

    expect(service.update).toHaveBeenCalledWith(
      'UTC502',
      expect.objectContaining({ code: 'UTC503' }),
    );
  });

  it('supprime après confirmation seulement', async () => {
    setup([UTC502]);
    service.remove.mockReturnValue(of(undefined));
    dialog.confirmDeletion.mockResolvedValue(false);

    click('Supprimer l’UE UTC502');
    await settle();
    expect(dialog.confirmDeletion).toHaveBeenCalledWith(
      'Supprimer l’UE',
      'L’UE UTC502 sera supprimée. Elle doit être vide.',
    );
    expect(service.remove).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    click('Supprimer l’UE UTC502');
    await settle();
    expect(service.remove).toHaveBeenCalledWith('UTC502');
  });
});
