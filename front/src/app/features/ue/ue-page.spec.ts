import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Course, CourseService } from '../cours/course.service';
import { TermService } from '../termes/term.service';
import { UePage } from './ue-page';
import { UeService } from './ue.service';

describe('UePage', () => {
  let fixture: ComponentFixture<UePage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const ueService = { get: vi.fn<UeService['get']>() };
  const courseService = {
    list: vi.fn<CourseService['list']>(),
    create: vi.fn<CourseService['create']>(),
    reorder: vi.fn<CourseService['reorder']>(),
  };
  const termService = {
    list: vi.fn<TermService['list']>(),
    remove: vi.fn<TermService['remove']>(),
    revision: signal(0),
  };
  const dialog = { confirmDeletion: vi.fn<DialogService['confirmDeletion']>() };

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UeService, useValue: ueService },
        { provide: CourseService, useValue: courseService },
        { provide: TermService, useValue: termService },
        { provide: DialogService, useValue: dialog },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(UePage);
    fixture.componentRef.setInput('code', 'UTC502');
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

  function submitTitle(title: string): void {
    const field = element().querySelector<HTMLInputElement>('#course-title');
    if (field) {
      field.value = title;
      field.dispatchEvent(new Event('input'));
    }
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    ueService.get.mockReturnValue(
      of({ id: 1, code: 'UTC502', title: 'Systèmes', description: '', position: 1 }),
    );
    courseService.list.mockReturnValue(
      of([{ id: 7, title: 'Processus', position: 1, updatedAt: '2026-11-10T10:00:00.000Z' }]),
    );
    termService.list.mockReturnValue(
      of([
        {
          id: 4,
          type: 'acronym',
          label: 'PID',
          expandedForm: 'Process Identifier',
          excerpt: '',
          ueCode: 'UTC502',
          courseId: 12,
          courseTitle: 'Processus',
        },
      ]),
    );
  });

  it('affiche les termes de l’UE dans leur onglet', () => {
    setup();
    expect(element().querySelector('.tabs')?.textContent.replace(/\s+/g, ' ')).toContain(
      'Termes 1',
    );
    expect(element().querySelector('.term-label')).toBeNull();

    fixture.componentRef.setInput('onglet', 'termes');
    fixture.detectChanges();

    expect(termService.list).toHaveBeenCalledWith({ ue: 'UTC502' });
    expect(element().querySelector('a.term')?.getAttribute('href')).toBe('/glossaire/4');
    expect(element().querySelector('ol.list')).toBeNull();
    expect(element().querySelector('.term-actions a')?.getAttribute('href')).toBe(
      '/glossaire/4/edition',
    );
  });

  it('filtre les termes de l’onglet par type et montre le cours d’origine', () => {
    setup();
    fixture.componentRef.setInput('onglet', 'termes');
    fixture.detectChanges();

    expect(element().querySelector('.origin a')?.getAttribute('href')).toBe('/ue/UTC502/cours/12');
    expect(element().querySelector('.pill.type')?.textContent).toBe('Acronyme');

    Array.from(element().querySelectorAll<HTMLButtonElement>('app-segmented button'))
      .find((button) => button.textContent.trim() === 'Définitions')
      ?.click();
    fixture.detectChanges();

    expect(element().querySelector('a.term')).toBeNull();
    expect(element().textContent).toContain('Aucun terme ne correspond.');
  });

  it('supprime un terme de l’onglet après confirmation seulement, puis recharge', async () => {
    setup();
    fixture.componentRef.setInput('onglet', 'termes');
    fixture.detectChanges();
    termService.remove.mockReturnValue(of(undefined));
    const remove = async (): Promise<void> => {
      element().querySelector<HTMLButtonElement>('button[aria-label="Supprimer PID"]')?.click();
      // La modale répond de façon asynchrone : on laisse la réponse arriver.
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    };

    dialog.confirmDeletion.mockResolvedValue(false);
    await remove();
    expect(termService.remove).not.toHaveBeenCalled();

    dialog.confirmDeletion.mockResolvedValue(true);
    await remove();
    expect(termService.remove).toHaveBeenCalledWith(4);
    expect(termService.list).toHaveBeenCalledTimes(2);
  });

  it('se recharge quand un terme vient d’être créé', () => {
    setup();

    termService.revision.update((revision) => revision + 1);
    fixture.detectChanges();

    expect(termService.list).toHaveBeenCalledTimes(2);
  });

  it('affiche l’UE et ses cours', () => {
    setup();

    expect(element().textContent).toContain('UTC502');
    expect(element().textContent).toContain('Processus');
    expect(element().querySelector('a.course-title')?.getAttribute('href')).toBe(
      '/ue/UTC502/cours/7',
    );
  });

  const PROCESSUS = {
    id: 7,
    title: 'Processus',
    position: 1,
    updatedAt: '2026-11-10T10:00:00.000Z',
  };
  const MEMOIRE = { id: 9, title: 'Mémoire', position: 2, updatedAt: '2026-11-10T10:00:00.000Z' };

  function courseTitles(): string[] {
    return Array.from(element().querySelectorAll('.course-title')).map((title) =>
      (title.textContent ?? '').trim(),
    );
  }

  function pressOnHandle(index: number, key: string): void {
    const handle = element().querySelectorAll('.course .sort-handle').item(index);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  }

  it('réordonne les cours depuis la poignée, renumérote et enregistre', () => {
    courseService.list.mockReturnValue(of([PROCESSUS, MEMOIRE]));
    courseService.reorder.mockReturnValue(of([MEMOIRE, PROCESSUS]));
    setup();

    pressOnHandle(1, 'ArrowUp');

    expect(courseTitles()).toEqual(['Mémoire', 'Processus']);
    expect(
      Array.from(element().querySelectorAll('.course-position')).map((rank) => rank.textContent),
    ).toEqual(['1', '2']);
    expect(courseService.reorder).toHaveBeenCalledWith('UTC502', [9, 7]);
  });

  it('revient à l’ordre enregistré quand l’API refuse le nouvel ordre', () => {
    courseService.list.mockReturnValue(of([PROCESSUS, MEMOIRE]));
    courseService.reorder.mockReturnValue(
      throwError(() => new ApiError(400, ['L’ordre doit contenir tous les cours de l’UE.'])),
    );
    setup();

    pressOnHandle(0, 'ArrowDown');

    expect(element().textContent).toContain('L’ordre doit contenir tous les cours de l’UE.');
    expect(courseTitles()).toEqual(['Processus', 'Mémoire']);
  });

  it('ne propose plus de saisir l’ordre d’un nouveau cours', () => {
    setup();
    click('Nouveau cours');

    expect(element().querySelector('#course-position')).toBeNull();
  });

  it('crée un cours puis l’ouvre en édition', () => {
    courseService.create.mockReturnValue(of({ id: 8 } as Course));
    setup();
    click('Nouveau cours');

    submitTitle(' Mémoire ');

    expect(courseService.create).toHaveBeenCalledWith('UTC502', { title: 'Mémoire' });
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502', 'cours', 8, 'edition']);
  });

  it('affiche le refus de l’API sans quitter la page', () => {
    courseService.create.mockReturnValue(
      throwError(() => new ApiError(400, ['Le titre ne doit pas dépasser 200 caractères.'])),
    );
    setup();
    click('Nouveau cours');

    submitTitle('Doublon');

    expect(element().textContent).toContain('Le titre ne doit pas dépasser 200 caractères.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signale une UE inconnue', () => {
    ueService.get.mockReturnValue(
      throwError(() => new ApiError(404, ['L’UE UTC502 n’existe pas.'])),
    );
    setup();

    expect(element().textContent).toContain('L’UE UTC502 n’existe pas.');
  });
});
