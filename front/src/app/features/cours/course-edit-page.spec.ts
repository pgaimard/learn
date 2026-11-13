import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { ImageViewerService } from '../../core/ui/image-viewer.service';
import { CourseContent } from './content/course-content';
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
    content: [
      {
        type: 'paragraph',
        // L'éditeur précise pour chaque bloc s'il est épinglé à la fiche de révision.
        attrs: { pinned: false },
        content: [{ type: 'text', text: 'Un programme.' }],
      },
    ],
  },
};

describe('CourseEditPage', () => {
  let fixture: ComponentFixture<CourseEditPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const service = {
    get: vi.fn<CourseService['get']>(),
    update: vi.fn<CourseService['update']>(),
    remove: vi.fn<CourseService['remove']>(),
    uploadImage: vi.fn<CourseService['uploadImage']>(),
  };
  const dialog = {
    confirm: vi.fn<DialogService['confirm']>(),
    confirmDeletion: vi.fn<DialogService['confirmDeletion']>(),
    prompt: vi.fn<DialogService['prompt']>(),
  };

  // La modale répond de façon asynchrone : on laisse la réponse arriver.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function setup(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: dialog },
        { provide: CourseService, useValue: service },
      ],
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
      // Le rappel du raccourci (« ⌘S ») ne fait pas partie du nom du bouton.
      .find(
        (button) =>
          Array.from(button.childNodes)
            .filter((node) => !(node instanceof Element && node.classList.contains('kbd')))
            .map((node) => node.textContent)
            .join('')
            .trim() === label,
      )
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

  it('enregistre le titre et le contenu de l’éditeur', async () => {
    service.update.mockReturnValue(of(COURSE));
    await setup();
    typeTitle(' Les processus ');

    click('Enregistrer');

    expect(service.update).toHaveBeenCalledWith(7, {
      title: 'Les processus',
      content: COURSE.content,
    });
    expect(element().textContent).toContain('Enregistré à');
  });

  it('affiche le refus de l’API et garde les modifications en attente', async () => {
    service.update.mockReturnValue(
      throwError(() => new ApiError(400, ['Le titre ne doit pas dépasser 200 caractères.'])),
    );
    await setup();
    typeTitle('Autre titre');

    click('Enregistrer');

    expect(element().textContent).toContain('Le titre ne doit pas dépasser 200 caractères.');
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
    dialog.confirm.mockResolvedValue(false);

    expect(fixture.componentInstance.canLeave()).toBe(true);
    expect(dialog.confirm).not.toHaveBeenCalled();

    typeTitle('Modifié');
    expect(await fixture.componentInstance.canLeave()).toBe(false);
    expect(dialog.confirm).toHaveBeenCalledWith({
      title: 'Modifications non enregistrées',
      message: 'Quitter cette page fera perdre les modifications en cours.',
      confirmLabel: 'Quitter sans enregistrer',
      isDestructive: true,
    });
  });

  // jsdom ne transmet pas une sélection du document à l'éditeur : on la pose par son API.
  function selectAllText(): void {
    const content = fixture.debugElement.query(By.directive(CourseContent))
      .componentInstance as CourseContent;
    content.editor()?.commands.selectAll();
    // La barre de mise en forme apparaît avec la sélection.
    fixture.detectChanges();
  }

  it('ne compte pas comme une modification le fait de placer le curseur ou de sélectionner', async () => {
    // Un cours qui finit par un bloc de code : l'éditeur lui ajoute de lui-même un
    // paragraphe final à la première action, ce qui n'est pas une modification.
    service.get.mockReturnValue(
      of({
        ...COURSE,
        content: {
          type: 'doc',
          content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'ls' }] }],
        },
      }),
    );
    await setup();

    selectAllText();

    expect(fixture.componentInstance.canLeave()).toBe(true);
  });

  it('met en gras depuis la barre d’outils et signale la modification', async () => {
    await setup();
    dialog.confirm.mockResolvedValue(false);
    selectAllText();

    element().querySelector<HTMLButtonElement>('app-editor-toolbar [aria-label="Gras"]')?.click();
    fixture.detectChanges();

    expect(element().querySelector('.ProseMirror strong')).not.toBeNull();
    expect(element().querySelector('.status')?.textContent).toContain(
      'Modifications non enregistrées',
    );
    expect(await fixture.componentInstance.canLeave()).toBe(false);
  });

  it('affiche le plan du chapitre et le tient à jour pendant la saisie', async () => {
    service.get.mockReturnValue(
      of({
        ...COURSE,
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2, pinned: false },
              content: [{ type: 'text', text: '1. Notion' }],
            },
            { type: 'paragraph', attrs: { pinned: false }, content: [{ type: 'text', text: 'x' }] },
          ],
        },
      }),
    );
    await setup();
    const plan = (): string[] =>
      Array.from(element().querySelectorAll('.plan nav button')).map((entry) =>
        (entry.textContent ?? '').trim(),
      );

    expect(plan()).toEqual(['1. Notion']);

    const content = fixture.debugElement.query(By.directive(CourseContent))
      .componentInstance as CourseContent;
    content.editor()?.chain().selectAll().setHeading({ level: 3 }).run();
    fixture.detectChanges();

    expect(plan()).toEqual(['1. Notion', 'x']);
  });

  it('pose un lien avec l’adresse saisie dans la modale', async () => {
    await setup();
    dialog.prompt.mockResolvedValue(' https://www.cnam.fr ');
    selectAllText();

    click('Lien');
    await settle();

    expect(dialog.prompt).toHaveBeenCalledWith({
      title: 'Lien',
      label: 'Adresse du lien',
      initialValue: 'https://',
      hint: 'Laisser vide pour retirer le lien.',
    });
    expect(element().querySelector('.ProseMirror a')?.getAttribute('href')).toBe(
      'https://www.cnam.fr',
    );
  });

  it('ne touche pas au texte quand la saisie du lien est annulée', async () => {
    await setup();
    dialog.prompt.mockResolvedValue(null);
    selectAllText();

    click('Lien');
    await settle();

    expect(dialog.prompt).toHaveBeenCalledOnce();
    expect(element().querySelector('.ProseMirror a')).toBeNull();
    expect(element().textContent).not.toContain('Modifications non enregistrées');
  });

  it('supprime le cours après confirmation puis revient à l’UE', async () => {
    service.remove.mockReturnValue(of(undefined));
    dialog.confirmDeletion.mockResolvedValue(true);
    await setup();

    click('Supprimer le cours');
    await settle();

    expect(service.remove).toHaveBeenCalledWith(7);
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502']);
  });

  function pickImage(): void {
    const field = element().querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['x'], 'capture.png', { type: 'image/png' });
    Object.defineProperty(field, 'files', { value: [file], configurable: true });
    field?.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('envoie l’image choisie puis l’insère comme figure dans le cours', async () => {
    service.uploadImage.mockReturnValue(of({ id: 4, src: '/api/courses/7/images/4', altText: '' }));
    service.update.mockReturnValue(of(COURSE));
    await setup();

    pickImage();
    click('Enregistrer');

    expect(service.uploadImage).toHaveBeenCalledWith(7, expect.any(File));
    expect(element().querySelector('figure img')?.getAttribute('src')).toBe(
      '/api/courses/7/images/4',
    );
    const saved = JSON.stringify(service.update.mock.calls[0][1].content);
    expect(saved).toContain('"type":"figure"');
    expect(saved).not.toContain('data:');
  });

  it('ajoute une seconde image après la première au lieu de la remplacer', async () => {
    service.uploadImage
      .mockReturnValueOnce(of({ id: 4, src: '/api/courses/7/images/4', altText: '' }))
      .mockReturnValueOnce(of({ id: 5, src: '/api/courses/7/images/5', altText: '' }));
    await setup();

    pickImage();
    pickImage();

    const sources = Array.from(element().querySelectorAll('figure img')).map((image) =>
      image.getAttribute('src'),
    );
    expect(sources).toEqual(['/api/courses/7/images/4', '/api/courses/7/images/5']);
    // En édition, un clic sélectionne l'image : il ne l'ouvre pas en grand.
    const image = element().querySelector('figure img') as HTMLImageElement;
    image.click();
    expect(image.hasAttribute('tabindex')).toBe(false);
    expect(TestBed.inject(ImageViewerService).image()).toBeNull();
  });

  it('affiche le refus de l’API quand l’image n’est pas acceptée', async () => {
    service.uploadImage.mockReturnValue(
      throwError(
        () =>
          new ApiError(400, ['Format non pris en charge : seuls PNG, JPEG et SVG sont acceptés.']),
      ),
    );
    await setup();

    pickImage();

    expect(element().textContent).toContain('Format non pris en charge');
    expect(element().querySelector('figure')).toBeNull();
  });
});
