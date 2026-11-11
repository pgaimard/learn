import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
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
  const taskService = { list: vi.fn<TaskService['list']>() };

  function setup(week = '2026-11-16'): void {
    eventService.list.mockReturnValue(of([COURSE, DEADLINE]));
    taskService.list.mockReturnValue(of([TASK]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: eventService },
        { provide: TaskService, useValue: taskService },
        { provide: UeService, useValue: { list: () => of(UES) } },
      ],
    });
    fixture = TestBed.createComponent(AgendaPage);
    fixture.componentRef.setInput('semaine', week);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(target: Element | null = element()): string {
    return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function days(): HTMLElement[] {
    return Array.from(element().querySelectorAll<HTMLElement>('.day'));
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

    expect(eventService.list).toHaveBeenCalledWith(new Date(2026, 10, 16), new Date(2026, 10, 23));
    expect(taskService.list).toHaveBeenCalledWith({
      dueFrom: new Date(2026, 10, 16).toISOString(),
      dueTo: new Date(2026, 10, 23).toISOString(),
    });
    expect(text(element().querySelector('.period'))).toBe(
      'Du lundi 16 novembre au dimanche 22 novembre 2026',
    );
  });

  it('range les événements et les tâches dans leur jour, par heure', () => {
    setup();

    expect(days()).toHaveLength(7);
    expect(text(days()[0])).toContain('Rien de prévu.');
    const tuesday = Array.from(days()[1].querySelectorAll('.entry')).map((entry) => text(entry));
    expect(tuesday[0]).toContain('12:00 Rendre le TP Tâche');
    expect(tuesday[1]).toContain('18:00 – 21:00 Cours systèmes Cours UTC502');
    expect(text(days()[4])).toContain('23:00 Rendu du projet Échéance');
  });

  it('mène aux semaines voisines par l’adresse', () => {
    setup();

    const links = Array.from(element().querySelectorAll('.weeks a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual(['/?semaine=2026-11-09', '/', '/?semaine=2026-11-23']);
  });

  it('filtre par UE', () => {
    setup();

    fill('agenda-ue-filter', 'UTC502', 'change');

    expect(text()).toContain('Cours systèmes');
    expect(text()).not.toContain('Rendu du projet');
    expect(text()).not.toContain('Rendre le TP');
  });

  it('crée un cours répété chaque semaine et annonce le nombre d’événements', () => {
    setup();
    eventService.create.mockReturnValue(of([COURSE, COURSE, COURSE]));
    click('Ajouter un événement le mercredi 18 novembre');
    expect(element().querySelector<HTMLInputElement>('#event-start')?.value).toBe(
      '2026-11-18T09:00',
    );

    fill('event-title', ' TD systèmes ');
    fill('event-ue', 'UTC502', 'change');
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
    fill('event-type', 'deadline', 'change');
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

  it('supprime un événement après confirmation seulement', () => {
    setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    eventService.remove.mockReturnValue(of(undefined));

    click('Supprimer Cours systèmes');
    expect(eventService.remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    click('Supprimer Cours systèmes');
    expect(eventService.remove).toHaveBeenCalledWith(4);
  });
});
