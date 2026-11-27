import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../../core/dialog/dialog.service';
import { ApiError } from '../../../core/http/api-error';
import { Course, CourseService } from '../course.service';
import { CourseVersion, CourseVersionService } from './course-version.service';
import { CourseVersionsPage } from './course-versions-page';

const COURSE = { id: 7, title: 'Processus', revision: 12 } as Course;
const VERSIONS: CourseVersion[] = [
  { id: 3, origin: 'restore', revision: 11, title: 'Processus', createdAt: '2026-11-20T09:30:00Z' },
  {
    id: 2,
    origin: 'package',
    revision: 9,
    title: 'Les processus',
    createdAt: '2026-11-18T14:00:00Z',
  },
];

describe('CourseVersionsPage', () => {
  let fixture: ComponentFixture<CourseVersionsPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const versionService = {
    list: vi.fn<CourseVersionService['list']>(),
    restore: vi.fn<CourseVersionService['restore']>(),
  };
  const confirm = vi.fn<DialogService['confirm']>();

  function setup(versions: CourseVersion[] = VERSIONS): void {
    versionService.list.mockReset().mockReturnValue(of(versions));
    versionService.restore.mockReset().mockReturnValue(of(COURSE));
    confirm.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: { get: () => of(COURSE) } },
        { provide: CourseVersionService, useValue: versionService },
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CourseVersionsPage);
    fixture.componentRef.setInput('code', 'UTC502');
    fixture.componentRef.setInput('id', '7');
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function restoreFirst(): Promise<void> {
    element().querySelector<HTMLButtonElement>('.versions button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('liste les versions avec leur origine, et le titre quand il a changé', () => {
    setup();

    const rows = Array.from(element().querySelectorAll('.versions li')).map(
      (row) => row.textContent,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Avant une restauration');
    expect(rows[0]).not.toContain('Titre :');
    expect(rows[1]).toContain('Avant le remplacement par un paquet');
    expect(rows[1]).toContain('Titre : Les processus');
  });

  it('le dit quand le cours n’a aucune version précédente', () => {
    setup([]);

    expect(element().textContent).toContain('Aucune version précédente pour ce cours.');
    expect(element().querySelector('.versions')).toBeNull();
  });

  it('restaure après confirmation, avec la révision lue, puis ouvre le cours', async () => {
    setup();

    await restoreFirst();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Restaurer', isDestructive: false }),
    );
    expect(versionService.restore).toHaveBeenCalledWith(7, 3, 12);
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502', 'cours', 7]);
  });

  it('ne restaure rien si la confirmation est refusée', async () => {
    setup();
    confirm.mockResolvedValue(false);

    await restoreFirst();

    expect(versionService.restore).not.toHaveBeenCalled();
  });

  it('affiche le refus de l’API et reste sur la liste', async () => {
    setup();
    const refusal = 'Ce cours est ouvert dans l’éditeur. Fermez-le avant de le modifier autrement.';
    versionService.restore.mockReturnValue(throwError(() => new ApiError(409, [refusal])));

    await restoreFirst();

    expect(element().textContent).toContain(refusal);
    expect(navigate).not.toHaveBeenCalled();
    expect(element().querySelector<HTMLButtonElement>('.versions button')?.disabled).toBe(false);
  });
});
