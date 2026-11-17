import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { CourseRemoval } from './course-removal';
import { CourseFolder, CourseService } from './course.service';

const COURSE = { id: 7, title: 'Processus' };
const FOLDER: CourseFolder = { id: 3, name: 'Processus', fileCount: 2, folderCount: 1 };

describe('CourseRemoval', () => {
  const service = {
    folder: vi.fn<CourseService['folder']>(),
    remove: vi.fn<CourseService['remove']>(),
  };
  const dialog = {
    confirm: vi.fn<DialogService['confirm']>(),
    confirmDeletion: vi.fn<DialogService['confirmDeletion']>(),
  };

  function removal(): CourseRemoval {
    return TestBed.inject(CourseRemoval);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    service.remove.mockReturnValue(of(undefined));
    dialog.confirmDeletion.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: CourseService, useValue: service },
        { provide: DialogService, useValue: dialog },
      ],
    });
  });

  it('ne supprime rien sans confirmation', async () => {
    dialog.confirmDeletion.mockResolvedValue(false);

    expect(await removal().remove(COURSE)).toBe(false);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('supprime sans autre question quand le dossier du cours est vide', async () => {
    service.folder.mockReturnValue(of({ ...FOLDER, fileCount: 0, folderCount: 0 }));

    expect(await removal().remove(COURSE)).toBe(true);
    expect(dialog.confirm).not.toHaveBeenCalled();
    expect(service.remove).toHaveBeenCalledWith(7, false);
  });

  it('demande le sort du dossier non vide, et le garde par défaut', async () => {
    service.folder.mockReturnValue(of(FOLDER));
    dialog.confirm.mockResolvedValue(false);

    expect(await removal().remove(COURSE)).toBe(true);
    expect(dialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('2 fichier(s) et 1 sous-dossier(s)') as string,
        cancelLabel: 'Garder le dossier',
      }),
    );
    expect(service.remove).toHaveBeenCalledWith(7, false);
  });

  it('supprime le dossier avec le cours quand on le demande', async () => {
    service.folder.mockReturnValue(of(FOLDER));
    dialog.confirm.mockResolvedValue(true);

    await removal().remove(COURSE);

    expect(service.remove).toHaveBeenCalledWith(7, true);
  });

  it('laisse remonter le refus de l’API', async () => {
    service.folder.mockReturnValue(of(null));
    service.remove.mockReturnValue(throwError(() => new ApiError(409, ['Refusé.'])));

    await expect(removal().remove(COURSE)).rejects.toMatchObject({ messages: ['Refusé.'] });
  });
});
