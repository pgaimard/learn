import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { pickOption } from '../../core/ui/dropdown.testing';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Task, TaskService } from '../taches/task.service';
import { UeService } from '../ue/ue.service';
import { AgendaPage } from './agenda-page';
import { AgendaEvent, EventService } from './event.service';

const UES = [{ id: 1, code: 'UTC502', title: 'Systèmes', description: '', position: 1 }];
const COURSE: AgendaEvent = {
  id: 4,
  title: 'Cours systèmes',
  type: 'course',
  ue: { code: 'UTC502', title: 'Systèmes' },
  startsAt: new Date(2026, 10, 17, 18, 0).toISOString(),
  endsAt: new Date(2026, 10, 17, 21, 0).toISOString(),
};
const DEADLINE: AgendaEvent = {
  id: 5,
  title: 'Rendu du projet',
  type: 'deadline',
  ue: null,
  startsAt: new Date(2026, 10, 20, 23, 0).toISOString(),
  endsAt: new Date(2026, 10, 20, 23, 0).toISOString(),
};
const TASK: Task = {
  id: 9,
  title: 'Rendre le TP',
  ue: null,
  dueAt: new Date(2026, 10, 17, 12, 0).toISOString(),
  remindAt: null,
  done: false,
};

describe('AgendaPage', () => {
  let fixture: ComponentFixture<AgendaPage>;
  const eventService = {
    list: vi.fn<EventService['list']>(),
    create: vi.fn<EventService['create']>(),
    update: vi.fn<EventService['update']>(),
    remove: vi.fn<EventService['remove']>(),
  };
  const taskService = {
    list: vi.fn<TaskService['list']>(),
    update: vi.fn<TaskService['update']>(),
    remove: vi.fn<TaskService['remove']>(),
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

  // Les tests historiques portent sur la vue Liste ; les vues en grille ont les leurs.
  function setup(week = '2026-11-16', view = 'liste'): void {
    eventService.list.mockReturnValue(of([COURSE, DEADLINE]));
    taskService.list.mockReturnValue(of([TASK]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: dialog },
        { provide: EventService, useValue: eventService },
        { provide: TaskService, useValue: taskService },
        { provide: UeService, useValue: { list: () => of(UES) } },
      ],
    });
    fixture = TestBed.createComponent(AgendaPage);
    fixture.componentRef.setInput('semaine', week);
    fixture.componentRef.setInput('vue', view);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(target: Element | null = element()): string {
    return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function days(): HTMLElement[] {
    return Array.from(element().querySelectorAll<HTMLElement>('li.day'));
  }

  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find(
        (button) =>
          button.textContent.trim() === label || button.getAttribute('aria-label') === label,
      )
      ?.click();
    fixture.detectChanges();
  }

  // Coche ou décoche un filtre du panneau latéral, désigné par son libellé.
  function toggleFilter(label: string): void {
    Array.from(element().querySelectorAll<HTMLLabelElement>('.filters label'))
      .find((candidate) => text(candidate) === label)
      ?.querySelector('input')
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

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => vi.resetAllMocks());

  it('charge la semaine demandée, du lundi au lundi suivant', () => {
    setup('2026-11-18');

    // Une seule lecture couvre la semaine et les six semaines du mois affiché.
    const from = new Date(2026, 9, 26);
    const to = new Date(2026, 11, 7);
    expect(eventService.list).toHaveBeenCalledWith(from, to);
    expect(taskService.list).toHaveBeenCalledWith({
      dueFrom: from.toISOString(),
      dueTo: to.toISOString(),
    });
    expect(text(element().querySelector('h1'))).toBe('16 – 22 novembre 2026 · semaine 47');
  });

  it('range les événements et les tâches dans leur jour, par heure', () => {
    setup();

    expect(days()).toHaveLength(7);
    expect(text(days()[0])).toContain('Rien de prévu.');
    const tuesday = Array.from(days()[1].querySelectorAll('.entry')).map((entry) => text(entry));
    expect(tuesday[0]).toContain('12:00 Rendre le TP Tâche');
    expect(tuesday[1]).toContain('18:00 – 21:00 Cours systèmes UTC502 Cours');
    expect(text(days()[4])).toContain('23:00 Rendu du projet Échéance');
  });

  it('mène aux semaines voisines par l’adresse', () => {
    setup();

    const links = Array.from(element().querySelectorAll('.period a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual(['/?semaine=2026-11-09', '/', '/?semaine=2026-11-23']);
  });

  it('filtre par UE', () => {
    setup();

    toggleFilter('UTC502');

    expect(text(element().querySelector('.days'))).not.toContain('Cours systèmes');
    expect(text()).toContain('Rendre le TP');

    toggleFilter('UTC502');
    expect(text()).toContain('Cours systèmes');
  });

  it('crée un cours répété chaque semaine et annonce le nombre d’événements', () => {
    setup();
    eventService.create.mockReturnValue(of([COURSE, COURSE, COURSE]));
    click('Ajouter un événement le mercredi 18 novembre');
    expect(element().querySelector<HTMLInputElement>('#event-start')?.value).toBe(
      '2026-11-18T09:00',
    );

    fill('event-title', ' TD systèmes ');
    pickOption(fixture, '#event-ue', 'UTC502');
    fill('event-start', '2026-11-18T18:00');
    fill('event-end', '2026-11-18T20:00');
    fill('event-repeat', '2026-12-02');
    submit();

    const [details, occurrences] = eventService.create.mock.calls[0];
    expect(details).toEqual({ title: 'TD systèmes', type: 'course', ueCode: 'UTC502' });
    expect(occurrences).toEqual(
      [18, 25, 2].map((day, index) => ({
        startsAt: new Date(2026, index < 2 ? 10 : 11, day, 18, 0).toISOString(),
        endsAt: new Date(2026, index < 2 ? 10 : 11, day, 20, 0).toISOString(),
      })),
    );
    expect(text()).toContain('3 événements créés, un par semaine.');
    expect(eventService.list).toHaveBeenCalledTimes(2);
  });

  it('crée une échéance ponctuelle, sans champ de fin', () => {
    setup();
    eventService.create.mockReturnValue(of([DEADLINE]));
    click('Ajouter un événement le lundi 16 novembre');

    fill('event-title', 'Examen blanc');
    click('Échéance');
    expect(element().querySelector('#event-end')).toBeNull();
    fill('event-start', '2026-11-16T14:00');
    submit();

    const moment = new Date(2026, 10, 16, 14, 0).toISOString();
    expect(eventService.create).toHaveBeenCalledWith(
      { title: 'Examen blanc', type: 'deadline', ueCode: null },
      [{ startsAt: moment, endsAt: moment }],
    );
  });

  it('refuse une fin avant le début sans appeler l’API', () => {
    setup();
    click('Ajouter un événement le lundi 16 novembre');

    fill('event-title', 'Cours');
    fill('event-end', '2026-11-16T08:00');
    submit();

    expect(eventService.create).not.toHaveBeenCalled();
    expect(text()).toContain('La fin ne peut pas précéder le début.');
  });

  it('modifie un événement, sans proposer de répétition', () => {
    setup();
    eventService.update.mockReturnValue(of(COURSE));
    click('Modifier Cours systèmes');
    expect(element().querySelector('#event-repeat')).toBeNull();

    fill('event-title', 'Cours déplacé');
    submit();

    expect(eventService.update).toHaveBeenCalledWith(4, {
      title: 'Cours déplacé',
      type: 'course',
      ueCode: 'UTC502',
      startsAt: COURSE.startsAt,
      endsAt: COURSE.endsAt,
    });
  });

  it('affiche le refus de l’API et garde le formulaire', () => {
    setup();
    eventService.update.mockReturnValue(
      throwError(() => new ApiError(400, ['L’UE UTC502 n’existe pas.'])),
    );
    click('Modifier Cours systèmes');

    submit();

    expect(text()).toContain('L’UE UTC502 n’existe pas.');
    expect(element().querySelector('form')).not.toBeNull();
  });

  it('supprime un événement après confirmation seulement', async () => {
    setup();
    dialog.confirmDeletion.mockResolvedValue(false);
    eventService.remove.mockReturnValue(of(undefined));

    click('Supprimer Cours systèmes');
    await settle();
    expect(dialog.confirmDeletion).toHaveBeenCalledWith(
      'Supprimer l’événement',
      '« Cours systèmes » du mardi 17 novembre sera supprimé.',
    );
    expect(eventService.remove).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    click('Supprimer Cours systèmes');
    await settle();
    expect(eventService.remove).toHaveBeenCalledWith(4);
  });

  it('masque un type d’élément à la demande', () => {
    setup();

    toggleFilter('Tâches datées');
    expect(text()).not.toContain('Rendre le TP');
    expect(text()).toContain('Rendu du projet');

    toggleFilter('Échéances');
    expect(text()).not.toContain('Rendu du projet');
    expect(text()).toContain('Cours systèmes');
  });

  describe('vue Semaine', () => {
    it('place chaque élément dans la colonne de son jour, à son heure', () => {
      setup('2026-11-16', 'semaine');

      const columns = Array.from(element().querySelectorAll('app-week-grid .day'));
      expect(columns).toHaveLength(7);
      const course = columns[1].querySelector<HTMLElement>('button.block:not(.is-task)');
      expect(text(course)).toBe('Cours systèmes18:00 – 21:00');
      // 18 h, dix heures après l'ouverture de la grille à 8 h, quarante pixels par heure.
      expect(course?.style.top).toBe('400px');
      expect(course?.style.height).toBe('120px');
      expect(text(columns[1].querySelector('.block.is-task'))).toBe('Rendre le TP');
      expect(columns[4].querySelector('.block.is-deadline')).not.toBeNull();
    });

    it('ouvre un jour pour y créer un événement', () => {
      setup('2026-11-16', 'semaine');

      click('Ajouter un événement le jeudi 19 novembre');

      expect(element().querySelector<HTMLInputElement>('#event-start')?.value).toBe(
        '2026-11-19T09:00',
      );
    });

    it('montre le détail d’un événement, puis le modifie dans la même fenêtre', () => {
      setup('2026-11-16', 'semaine');
      eventService.update.mockReturnValue(of(COURSE));

      click('Cours systèmes, 18:00 – 21:00');

      const modal = (): Element | null => element().querySelector('dialog');
      expect(text(modal()?.querySelector('h2') ?? null)).toBe('Cours systèmes');
      expect(text(modal()?.querySelector('.detail') ?? null)).toContain('Type Cours');
      expect(text(modal()?.querySelector('.detail') ?? null)).toContain('UTC502');
      expect(text(modal()?.querySelector('.detail') ?? null)).toMatch(/Début.*18:00/);
      expect(element().querySelector('#event-title')).toBeNull();

      click('Modifier');
      expect(text(modal()?.querySelector('h2') ?? null)).toBe('Modifier l’événement');
      fill('event-title', 'Cours déplacé');
      submit();

      expect(eventService.update).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ title: 'Cours déplacé' }),
      );
      expect(modal()).toBeNull();
    });

    it('revient au détail quand la modification est annulée', () => {
      setup('2026-11-16', 'semaine');
      click('Cours systèmes, 18:00 – 21:00');
      click('Modifier');

      click('Annuler');

      expect(element().querySelector('#event-title')).toBeNull();
      expect(text(element().querySelector('dialog h2'))).toBe('Cours systèmes');
    });

    it('montre le détail d’une tâche, la modifie ou la marque comme faite', () => {
      setup('2026-11-16', 'semaine');
      taskService.update.mockReturnValue(of(TASK));

      click('Tâche : Rendre le TP, 12:00');
      expect(text(element().querySelector('dialog h2'))).toBe('Rendre le TP');
      expect(text(element().querySelector('dialog .detail'))).toContain('Tâche à faire');

      click('Modifier');
      fill('task-title', 'Rendre le TP 2');
      element().querySelector('app-task-form form')?.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(taskService.update).toHaveBeenCalledWith(
        TASK.id,
        expect.objectContaining({ title: 'Rendre le TP 2' }),
      );

      click('Tâche : Rendre le TP, 12:00');
      click('Marquer comme faite');
      expect(taskService.update).toHaveBeenLastCalledWith(TASK.id, { done: true });
      expect(element().querySelector('dialog')).toBeNull();
    });

    it('supprime depuis le détail, après confirmation', async () => {
      setup('2026-11-16', 'semaine');
      dialog.confirmDeletion.mockResolvedValue(true);
      eventService.remove.mockReturnValue(of(undefined));

      click('Cours systèmes, 18:00 – 21:00');
      click('Supprimer');
      await settle();

      expect(eventService.remove).toHaveBeenCalledWith(4);
      expect(element().querySelector('dialog')).toBeNull();
    });
  });

  describe('vue Mois', () => {
    it('affiche le mois en six semaines, avec les éléments dans leur jour', () => {
      setup('2026-11-16', 'mois');

      expect(text(element().querySelector('h1'))).toBe('novembre 2026');
      const cells = Array.from(element().querySelectorAll('app-month-grid .cell'));
      expect(cells).toHaveLength(42);
      // Le 17 novembre est le vingt-troisième jour d'une grille qui commence le 26 octobre.
      expect(text(cells[22])).toBe('17 Rendre le TP 18:00 Cours systèmes');

      click('Tâche : Rendre le TP, 12:00');
      expect(text(element().querySelector('dialog h2'))).toBe('Rendre le TP');
      expect(cells[0].classList).toContain('is-outside');
    });

    it('affiche le mois du jour désigné, même si sa semaine commence le mois d’avant', () => {
      // Le 1er décembre 2026 est un mardi : sa semaine commence le lundi 30 novembre.
      setup('2026-12-01', 'mois');

      expect(text(element().querySelector('h1'))).toBe('décembre 2026');
      expect(text(element().querySelector('app-mini-calendar .title'))).toBe('décembre 2026');
    });

    it('mène aux mois voisins', () => {
      setup('2026-11-16', 'mois');

      const links = Array.from(element().querySelectorAll('.period a')).map((link) =>
        link.getAttribute('href'),
      );
      expect(links).toEqual(['/?semaine=2026-10-01', '/', '/?semaine=2026-12-01']);
    });
  });

  describe('raccourcis et petit calendrier', () => {
    // Paramètres d'adresse demandés à chaque navigation.
    function navigations(): { queries: () => unknown[] } {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      return { queries: () => navigate.mock.calls.map((call) => call[1]?.queryParams) };
    }

    function press(key: string, target: EventTarget = document): void {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }

    it('change de période et de vue au clavier', () => {
      setup();
      const navigate = navigations();

      press('ArrowRight');
      press('m');
      press('t');

      expect(navigate.queries()).toEqual([
        { semaine: '2026-11-23', vue: 'liste' },
        { semaine: '2026-11-16', vue: 'mois' },
        { semaine: null, vue: 'liste' },
      ]);
    });

    it('laisse les touches à la saisie et au formulaire ouvert', () => {
      setup();
      const navigate = navigations();
      const field = document.createElement('input');
      document.body.append(field);

      press('m', field);
      click('Ajouter un événement le lundi 16 novembre');
      press('ArrowLeft');

      expect(navigate.queries()).toEqual([]);
      field.remove();
    });

    it('va au jour choisi dans le petit calendrier, dont la semaine est mise en avant', () => {
      setup();
      const navigate = navigations();

      expect(element().querySelectorAll('app-mini-calendar .is-in-week')).toHaveLength(7);
      click('mardi 3 novembre');

      expect(navigate.queries()).toEqual([{ semaine: '2026-11-03', vue: 'liste' }]);
    });
  });
});
