import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogHost } from './dialog-host';
import { DialogService } from './dialog.service';

describe('DialogHost', () => {
  let fixture: ComponentFixture<DialogHost>;
  let service: DialogService;
  let showModal: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    // jsdom n'ouvre pas les boîtes de dialogue : on simule l'ouverture et la fermeture.
    showModal = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      if (this.hasAttribute('open')) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      }
    };
    service = TestBed.inject(DialogService);
    fixture = TestBed.createComponent(DialogHost);
    // Dans le document : sans cela, aucun élément ne peut recevoir le focus.
    document.body.append(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(element().querySelectorAll('button'));
  }

  function ask(): Promise<boolean> {
    const answer = service.confirmDeletion('Supprimer l’UE', 'L’UE UTC502 sera supprimée.');
    fixture.detectChanges();
    return answer;
  }

  it('reste fermée tant que rien n’est demandé', () => {
    expect(showModal).not.toHaveBeenCalled();
    expect(buttons()).toEqual([]);
  });

  it('affiche la demande, « Annuler » en premier pour recevoir le focus', () => {
    void ask();

    expect(showModal).toHaveBeenCalledOnce();
    expect(element().querySelector('h2')?.textContent).toBe('Supprimer l’UE');
    expect(element().querySelector('p')?.textContent).toBe('L’UE UTC502 sera supprimée.');
    expect(buttons().map((button) => button.textContent.trim())).toEqual(['Annuler', 'Supprimer']);
    expect(buttons()[1].classList.contains('is-destructive')).toBe(true);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('confirme par le bouton d’action et se referme', async () => {
    const answer = ask();

    buttons()[1].click();
    fixture.detectChanges();

    expect(await answer).toBe(true);
    expect(element().querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('demande une saisie, champ prérempli et sélectionné, et renvoie le texte validé', async () => {
    const answer = service.prompt({
      title: 'Lien',
      label: 'Adresse du lien',
      initialValue: 'https://',
      hint: 'Laisser vide pour retirer le lien.',
    });
    fixture.detectChanges();
    const field = element().querySelector('input') as HTMLInputElement;

    expect(element().querySelector('label')?.textContent).toBe('Adresse du lien');
    expect(field.value).toBe('https://');
    expect(document.activeElement).toBe(field);
    expect(element().querySelector('.hint')?.textContent).toBe(
      'Laisser vide pour retirer le lien.',
    );

    field.value = 'https://cnam.fr';
    const submit = new Event('submit', { cancelable: true });
    element().querySelector('form')?.dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
    expect(await answer).toBe('https://cnam.fr');
  });

  it('renvoie null quand la saisie est annulée', async () => {
    const answer = service.prompt({ title: 'Lien', label: 'Adresse', initialValue: '' });
    fixture.detectChanges();

    buttons()[0].click();

    expect(await answer).toBeNull();
  });

  it('annule par le bouton « Annuler »', async () => {
    const answer = ask();

    buttons()[0].click();

    expect(await answer).toBe(false);
  });

  it('traite la fermeture par Échap comme une annulation', async () => {
    const answer = ask();

    element().querySelector('dialog')?.close();

    expect(await answer).toBe(false);
  });
});
