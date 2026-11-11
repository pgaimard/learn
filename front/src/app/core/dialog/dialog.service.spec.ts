import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    service = TestBed.inject(DialogService);
  });

  it('expose la demande de confirmation puis la retire à la réponse', async () => {
    const answer = service.confirmDeletion('Supprimer l’UE', 'L’UE UTC502 sera supprimée.');

    expect(service.request()).toEqual({
      kind: 'confirm',
      title: 'Supprimer l’UE',
      message: 'L’UE UTC502 sera supprimée.',
      confirmLabel: 'Supprimer',
      isDestructive: true,
    });

    service.answer(true);

    expect(await answer).toBe(true);
    expect(service.request()).toBeNull();
  });

  it('traite une annulation comme un refus de confirmer', async () => {
    const answer = service.confirmDeletion('Titre', 'Message');

    service.cancel();

    expect(await answer).toBe(false);
  });

  it('ignore une réponse sans demande en attente', async () => {
    const answer = service.confirmDeletion('Titre', 'Message');
    service.cancel();
    service.answer(true);

    expect(await answer).toBe(false);
  });

  it('annule une demande restée ouverte quand une autre arrive', async () => {
    const first = service.confirmDeletion('Première', 'Message');
    const second = service.confirmDeletion('Seconde', 'Message');

    expect(await first).toBe(false);
    expect(service.request()?.title).toBe('Seconde');

    service.answer(true);
    expect(await second).toBe(true);
  });

  it('renvoie le texte saisi, même vide, et null à l’annulation', async () => {
    const request = { title: 'Lien', label: 'Adresse', initialValue: 'https://' };

    const typed = service.prompt(request);
    expect(service.request()).toEqual({ kind: 'prompt', ...request });
    service.answer('https://cnam.fr');
    const emptied = service.prompt(request);
    service.answer('');
    const cancelled = service.prompt(request);
    service.cancel();

    expect(await typed).toBe('https://cnam.fr');
    expect(await emptied).toBe('');
    expect(await cancelled).toBeNull();
  });
});
