import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
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

  function setup(ues: Ue[]): void {
    vi.resetAllMocks();
    service.list.mockReturnValue(of(ues));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: dialog },
        { provide: UeService, useValue: service },
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
      (candidate) => candidate.textContent.trim() === label,
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
    click('Modifier');

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

    click('Supprimer');
    await settle();
    expect(dialog.confirmDeletion).toHaveBeenCalledWith(
      'Supprimer l’UE',
      'L’UE UTC502 sera supprimée. Elle doit être vide.',
    );
    expect(service.remove).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    click('Supprimer');
    await settle();
    expect(service.remove).toHaveBeenCalledWith('UTC502');
  });
});
