import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { CourseEditPage } from './course-edit-page';
import { Course, CourseService } from './course.service';

const COURSE: Course = {
  id: 7,
  title: 'Processus',
  position: 3,
  updatedAt: '2026-11-10T10:00:00.000Z',
  ue: { code: 'UTC502', title: 'Systèmes' },
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Un programme.' }] }],
  },
};

describe('CourseEditPage', () => {
  let fixture: ComponentFixture<CourseEditPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const service = {
    get: vi.fn<CourseService['get']>(),
    update: vi.fn<CourseService['update']>(),
    remove: vi.fn<CourseService['remove']>(),
  };

  async function setup(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CourseService, useValue: service }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CourseEditPage);
    fixture.componentRef.setInput('code', 'UTC502');
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

  function typeTitle(title: string): void {
    const field = element().querySelector<HTMLInputElement>('#edit-title');
    if (field) {
      field.value = title;
      field.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    service.get.mockReturnValue(of(COURSE));
  });

  it('affiche le cours dans un éditeur modifiable', async () => {
    await setup();

    expect(element().querySelector<HTMLInputElement>('#edit-title')?.value).toBe('Processus');
    const editor = element().querySelector('.ProseMirror');
    expect(editor?.getAttribute('contenteditable')).toBe('true');
    expect(editor?.textContent).toContain('Un programme.');
  });

  it('enregistre le titre, l’ordre et le contenu de l’éditeur', async () => {
    service.update.mockReturnValue(of(COURSE));
    await setup();
    typeTitle(' Les processus ');

    click('Enregistrer');

    expect(service.update).toHaveBeenCalledWith(7, {
      title: 'Les processus',
      position: 3,
      content: COURSE.content,
    });
    expect(element().textContent).toContain('Enregistré à');
  });

  it('affiche le refus de l’API et garde les modifications en attente', async () => {
    service.update.mockReturnValue(
      throwError(() => new ApiError(409, ['Un cours occupe déjà l’ordre 3 dans cette UE.'])),
    );
    await setup();
    typeTitle('Autre titre');

    click('Enregistrer');

    expect(element().textContent).toContain('Un cours occupe déjà l’ordre 3 dans cette UE.');
    expect(element().textContent).toContain('Modifications non enregistrées');
  });

  it('n’enregistre pas un titre vide', async () => {
    await setup();
    typeTitle(' ');

    click('Enregistrer');

    expect(service.update).not.toHaveBeenCalled();
  });

  it('demande confirmation avant de quitter avec des modifications en attente', async () => {
    await setup();
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);

    expect(fixture.componentInstance.canLeave()).toBe(true);
    expect(confirmation).not.toHaveBeenCalled();

    typeTitle('Modifié');
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(confirmation).toHaveBeenCalled();
  });

  it('supprime le cours après confirmation puis revient à l’UE', async () => {
    service.remove.mockReturnValue(of(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await setup();

    click('Supprimer le cours');

    expect(service.remove).toHaveBeenCalledWith(7);
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502']);
  });
});
