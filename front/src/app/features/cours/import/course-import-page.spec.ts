import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { Course } from '../course.service';
import { CourseImportPage } from './course-import-page';
import { CourseImportService, ImportPreview } from './course-import.service';

const PREVIEW: ImportPreview = {
  ueCode: 'UTC502',
  title: 'Les processus',
  position: 3,
  sectionCount: 2,
  imageCount: 1,
  termCount: 3,
  termImageCount: 2,
  newTerms: [
    { type: 'definition', label: 'Processus' },
    { type: 'acronym', label: 'PCB' },
  ],
  duplicateTerms: [{ type: 'acronym', label: 'PID' }],
  existingCourse: null,
};
const IMPORTED = { id: 9, ue: { code: 'UTC502', title: 'Systèmes' } } as Course;

describe('CourseImportPage', () => {
  let fixture: ComponentFixture<CourseImportPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const service = {
    preview: vi.fn<CourseImportService['preview']>(),
    import: vi.fn<CourseImportService['import']>(),
  };
  const file = new File(['zip'], 'paquet.zip', { type: 'application/zip' });

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CourseImportService, useValue: service }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CourseImportPage);
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

  function pickPackage(): void {
    const field = element().querySelector<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(field, 'files', { value: { item: () => file }, configurable: true });
    field?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => vi.resetAllMocks());

  it('affiche l’aperçu du paquet choisi avant tout import', () => {
    service.preview.mockReturnValue(of(PREVIEW));
    setup();

    pickPackage();

    expect(service.preview).toHaveBeenCalledWith({ kind: 'package', file });
    expect(service.import).not.toHaveBeenCalled();
    const text = element().textContent;
    expect(text).toContain('Les processus');
    expect(text).toContain('UTC502');
    expect(text).toContain('Images des définitions');
  });

  it('annonce les termes à ajouter et ceux déjà présents', () => {
    setup();
    service.preview.mockReturnValue(of(PREVIEW));

    pickPackage();

    const text = element().textContent.replace(/\s+/g, ' ');
    expect(text).toContain('2 à ajouter au dictionnaire et au glossaire : Processus, PCB');
    expect(text).toContain('1 déjà présents : PID');
  });

  it('importe après confirmation puis ouvre le cours', () => {
    service.preview.mockReturnValue(of(PREVIEW));
    service.import.mockReturnValue(of(IMPORTED));
    setup();
    pickPackage();

    click('Importer le cours');

    expect(service.import).toHaveBeenCalledWith({ kind: 'package', file }, false, false);
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502', 'cours', 9]);
  });

  it('remplace la définition des termes déjà présents quand la case est cochée', () => {
    service.preview.mockReturnValue(of(PREVIEW));
    service.import.mockReturnValue(of(IMPORTED));
    setup();
    pickPackage();

    element().querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    click('Importer le cours');

    expect(service.import).toHaveBeenCalledWith({ kind: 'package', file }, false, true);
  });

  it('ne propose pas de remplacer les termes quand aucun n’est déjà présent', () => {
    service.preview.mockReturnValue(of({ ...PREVIEW, duplicateTerms: [] }));
    setup();

    pickPackage();

    expect(element().querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('prévient du remplacement d’un chapitre existant et le confirme à l’import', () => {
    service.preview.mockReturnValue(
      of({ ...PREVIEW, existingCourse: { id: 5, title: 'Ancienne version' } }),
    );
    service.import.mockReturnValue(of(IMPORTED));
    setup();
    pickPackage();

    expect(element().textContent).toContain('« Ancienne version » existe déjà dans UTC502');
    click('Remplacer le chapitre');

    expect(service.import).toHaveBeenCalledWith({ kind: 'package', file }, true, false);
  });

  it('liste les erreurs d’un paquet invalide sans proposer l’import', () => {
    service.preview.mockReturnValue(
      throwError(
        () =>
          new ApiError(400, [
            'cours.md, ligne 12 : titre de niveau 1 non pris en charge : utilisez les niveaux 2 à 4.',
            'cours.md référence « images/fig-02.png », absent du paquet.',
          ]),
      ),
    );
    setup();

    pickPackage();

    expect(element().querySelectorAll('.errors li')).toHaveLength(2);
    expect(element().textContent).not.toContain('Importer le cours');
  });

  it('analyse du Markdown collé', () => {
    service.preview.mockReturnValue(
      of({
        ...PREVIEW,
        imageCount: 0,
        termCount: 0,
        termImageCount: 0,
        newTerms: [],
        duplicateTerms: [],
      }),
    );
    setup();
    click('Markdown collé');
    const field = element().querySelector<HTMLTextAreaElement>('#import-markdown');
    if (field) {
      field.value = '---\nue: UTC502\n---\n## Titre';
      field.dispatchEvent(new Event('input'));
    }

    click('Analyser');

    expect(service.preview).toHaveBeenCalledWith({
      kind: 'markdown',
      markdown: '---\nue: UTC502\n---\n## Titre',
    });
    expect(element().textContent).not.toContain('Images des définitions');
  });

  it('annule l’aperçu sans importer', () => {
    service.preview.mockReturnValue(of(PREVIEW));
    setup();
    pickPackage();

    click('Annuler');

    expect(element().querySelector('.preview')).toBeNull();
    expect(service.import).not.toHaveBeenCalled();
  });
});
