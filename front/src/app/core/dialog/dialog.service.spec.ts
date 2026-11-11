import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    service = TestBed.inject(DialogService);
  });

  it('expose la demande puis la retire à la réponse', async () => {
    const answer = service.confirmDeletion('Supprimer l’UE', 'L’UE UTC502 sera supprimée.');

    expect(service.request()).toEqual({
      title: 'Supprimer l’UE',
      message: 'L’UE UTC502 sera supprimée.',
      confirmLabel: 'Supprimer',
      isDestructive: true,
    });

    service.answer(true);

    expect(await answer).toBe(true);
    expect(service.request()).toBeNull();
  });

  it('ignore une réponse sans demande en attente', async () => {
    const answer = service.confirmDeletion('Titre', 'Message');
    service.answer(false);
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
});
