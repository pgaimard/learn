import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { ContentNode } from './content/content-node';
import { Course, CourseService } from './course.service';
import { SheetEditPage } from './sheet-edit-page';

const SHEET: ContentNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'L’essentiel' }] },
    { type: 'paragraph', attrs: { pinned: false }, content: [{ type: 'text', text: 'fork' }] },
  ],
};

const COURSE: Course = {
  id: 7,
  title: 'Processus',
  position: 3,
  updatedAt: '2026-11-10T10:00:00.000Z',
  ue: { code: 'UTC502', title: 'Systèmes' },
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  sheetContent: SHEET,
  bookmarkTitle: null,
  bookmarkBlock: null,
};

describe('SheetEditPage', () => {
  let fixture: ComponentFixture<SheetEditPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const service = {
    get: vi.fn<CourseService['get']>(),
    update: vi.fn<CourseService['update']>(),
    uploadImage: vi.fn<CourseService['uploadImage']>(),
  };
  const dialog = {
    confirm: vi.fn<DialogService['confirm']>(),
    confirmDeletion: vi.fn<DialogService['confirmDeletion']>(),
  };

  async function setup(course: Course = COURSE, bloc?: string): Promise<void> {
    service.get.mockReset().mockReturnValue(of(course));
    service.update.mockReset().mockReturnValue(of(course));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: service },
        { provide: DialogService, useValue: dialog },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SheetEditPage);
    fixture.componentRef.setInput('code', 'UTC502');
    fixture.componentRef.setInput('id', '7');
    fixture.componentRef.setInput('bloc', bloc);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').trim().startsWith(label),
    );
  }

  // Une retouche dans l’éditeur : c’est elle qui rend la fiche enregistrable.
  function edit(): void {
    fixture.debugElement.query(By.css('app-content-editor')).triggerEventHandler('edited');
    fixture.detectChanges();
  }

  function link(label: string): HTMLAnchorElement | undefined {
    return Array.from(element().querySelectorAll('a')).find(
      (candidate) => (candidate.textContent ?? '').trim() === label,
    );
  }

  it('charge la fiche du cours et l’enregistre sans toucher au cours', async () => {
    await setup();

    expect(element().querySelector('.ProseMirror h2')?.textContent).toBe('L’essentiel');
    expect(button('Enregistrer')?.disabled).toBe(true);
    edit();
    button('Enregistrer')?.click();
    fixture.detectChanges();

    expect(service.update).toHaveBeenCalledWith(7, { sheetContent: SHEET });
    expect(button('Enregistrer')?.disabled).toBe(true);
  });

  it('part d’une page blanche pour un chapitre sans fiche, qu’on ne peut pas encore supprimer', async () => {
    await setup({ ...COURSE, sheetContent: null });

    expect(element().querySelector('.ProseMirror')?.textContent).toBe('');
    expect(
      element().querySelector<HTMLButtonElement>('[aria-label="Supprimer la fiche"]'),
    ).toBeNull();

    edit();
    button('Enregistrer')?.click();
    fixture.detectChanges();

    expect(service.update).toHaveBeenCalledTimes(1);
    expect(
      element().querySelector<HTMLButtonElement>('[aria-label="Supprimer la fiche"]'),
    ).not.toBeNull();
  });

  it('revient à la fiche en lecture, au bloc d’où l’on vient', async () => {
    await setup(COURSE, '1');

    expect(link('Terminer')?.getAttribute('href')).toBe('/ue/UTC502/cours/7?vue=fiche&bloc=1');
  });

  it('supprime la fiche après confirmation, puis revient au cours', async () => {
    await setup();
    dialog.confirmDeletion.mockReset().mockResolvedValue(true);

    element().querySelector<HTMLButtonElement>('[aria-label="Supprimer la fiche"]')?.click();
    await fixture.whenStable();

    expect(service.update).toHaveBeenCalledWith(7, { sheetContent: null });
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502', 'cours', 7]);
  });

  it('affiche le refus de l’API et garde la saisie', async () => {
    await setup();
    service.update.mockReturnValue(
      throwError(() => new ApiError(400, ['Type de bloc non autorisé.'])),
    );

    edit();
    button('Enregistrer')?.click();
    fixture.detectChanges();

    expect(element().querySelector('.form-error')?.textContent).toContain('non autorisé');
    expect(button('Enregistrer')?.disabled).toBe(false);
    expect(element().querySelector('.ProseMirror h2')).not.toBeNull();
  });
});
