import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ImageViewerService } from '../../core/ui/image-viewer.service';
import { ContentNode } from './content/content-node';
import { CourseContent } from './content/course-content';
import { CommandGroup, CommandService } from '../outils/command.service';
import { TermService, TermSummary } from '../termes/term.service';
import { CourseReadPage } from './course-read-page';
import { Course, CourseService } from './course.service';

function heading(level: number, text: string): ContentNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function paragraph(text: string, pinned = false): ContentNode {
  return { type: 'paragraph', attrs: { pinned }, content: [{ type: 'text', text }] };
}

const RETENIR: ContentNode = {
  type: 'callout',
  attrs: { kind: 'retenir', pinned: false },
  content: [paragraph('Un programme est passif.')],
};

function course(...content: ContentNode[]): Course {
  return {
    id: 7,
    title: 'Processus',
    position: 1,
    updatedAt: '2026-11-10T10:00:00.000Z',
    ue: { code: 'UTC502', title: 'Systèmes' },
    content: { type: 'doc', content },
    sheetContent: null,
    bookmarkTitle: null,
    bookmarkBlock: null,
  };
}

const COURSE = course(
  heading(2, '1. Notion'),
  paragraph('Texte courant.'),
  RETENIR,
  heading(2, '2. Création'),
  paragraph('Détails.'),
  heading(3, '2.1 fork'),
  paragraph('Appel épinglé.', true),
  heading(2, '3. Annexe'),
  paragraph('Rien pour la fiche.'),
);

describe('CourseReadPage', () => {
  let fixture: ComponentFixture<CourseReadPage>;

  const listTerms = vi.fn<TermService['list']>();
  const getTerm = vi.fn<TermService['get']>();
  const listCommands = vi.fn<CommandService['listByCourse']>();
  const setBookmark = vi.fn<CourseService['setBookmark']>();
  const removeBookmark = vi.fn<CourseService['removeBookmark']>();
  const removeCourse = vi.fn<CourseService['remove']>();
  const confirmDeletion = vi.fn<DialogService['confirmDeletion']>();

  async function setup(
    shown: Course,
    view?: string,
    terms: TermSummary[] = [],
    bloc?: string,
  ): Promise<void> {
    listTerms.mockReset().mockReturnValue(of(terms));
    if (!listCommands.getMockImplementation()) {
      listCommands.mockReturnValue(of([]));
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CourseService,
          useValue: {
            get: () => of(shown),
            remove: removeCourse,
            setBookmark,
            removeBookmark,
          },
        },
        { provide: DialogService, useValue: { confirmDeletion } },
        { provide: TermService, useValue: { list: listTerms, get: getTerm } },
        { provide: CommandService, useValue: { listByCourse: listCommands } },
      ],
    });
    fixture = TestBed.createComponent(CourseReadPage);
    fixture.componentRef.setInput('code', 'UTC502');
    fixture.componentRef.setInput('id', '7');
    fixture.componentRef.setInput('vue', view);
    fixture.componentRef.setInput('bloc', bloc);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function outline(): string[] {
    return Array.from(element().querySelectorAll('.outline button')).map((entry) =>
      (entry.textContent ?? '').trim(),
    );
  }

  // Textes des blocs de premier niveau du document affiché.
  function visibleBlocks(): string[] {
    return Array.from(element().querySelectorAll('.ProseMirror > *')).map((block) =>
      (block.textContent ?? '').trim(),
    );
  }

  function link(label: string): HTMLAnchorElement | undefined {
    return Array.from(element().querySelectorAll('a')).find(
      (candidate) => (candidate.textContent ?? '').trim() === label,
    );
  }

  it('supprime le cours après confirmation, et revient à son UE', async () => {
    await setup(COURSE);
    removeCourse.mockReset().mockReturnValue(of(undefined));
    confirmDeletion.mockReset().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const button = element().querySelector<HTMLButtonElement>('button[title="Supprimer le cours"]');

    button?.click();
    await fixture.whenStable();
    expect(removeCourse).not.toHaveBeenCalled();

    button?.click();
    await fixture.whenStable();
    expect(removeCourse).toHaveBeenCalledWith(COURSE.id);
    expect(navigate).toHaveBeenCalledWith(['/ue', 'UTC502']);
  });

  it('affiche le cours complet et propose la fiche de révision', async () => {
    await setup(COURSE);

    expect(visibleBlocks()).toHaveLength(9);
    expect(outline()).toEqual(['1. Notion', '2. Création', '2.1 fork', '3. Annexe']);
    expect(link('Fiche de révision')?.getAttribute('href')).toBe('/?vue=fiche');
    expect(element().querySelector('.sheet-note')).toBeNull();
  });

  it('sort le sommaire rétracté par son bouton, et le rentre dès qu’un titre est choisi', async () => {
    await setup(COURSE);
    const panel = element().querySelector('.outline') as HTMLElement;
    const toggle = element().querySelector('.outline-toggle') as HTMLButtonElement;
    expect(panel.classList.contains('is-open')).toBe(false);

    toggle.click();
    fixture.detectChanges();
    expect(panel.classList.contains('is-open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    panel.querySelector('button')?.click();
    fixture.detectChanges();
    expect(panel.classList.contains('is-open')).toBe(false);
  });

  it('suit un renvoi vers une section et propose de revenir à l’endroit quitté', async () => {
    await setup(
      course(heading(2, '1. Notion'), paragraph('Détails en section 2.'), heading(2, '2. Suite')),
    );
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(window, 'scrollY', { value: 420, configurable: true });
    const button = (label: string): HTMLButtonElement | undefined =>
      Array.from(element().querySelectorAll('button')).find(
        (candidate) => (candidate.textContent ?? '').trim() === label,
      );
    expect(button('Revenir à ma lecture')).toBeUndefined();

    element().querySelector<HTMLElement>('.section-ref')?.click();
    fixture.detectChanges();
    expect(element().querySelector('.outline .is-current')?.textContent.trim()).toBe('2. Suite');

    button('Revenir à ma lecture')?.click();
    fixture.detectChanges();
    expect(scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'smooth' });
    expect(button('Revenir à ma lecture')).toBeUndefined();
    scrollTo.mockRestore();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('ouvre dans une fenêtre la définition d’un terme cité dans le texte', async () => {
    const pcb: TermSummary = {
      id: 3,
      type: 'acronym',
      label: 'PCB',
      expandedForm: 'Process Control Block',
      excerpt: '',
      ueCode: null,
      courseId: null,
      courseTitle: null,
    };
    getTerm.mockReturnValue(
      of({
        id: 3,
        type: 'acronym',
        label: 'PCB',
        expandedForm: 'Process Control Block',
        content: { type: 'doc', content: [paragraph('Bloc de contrôle du processus.')] },
        ue: null,
        course: null,
      }),
    );
    await setup(course(paragraph('Le PCB est mis à jour.')), undefined, [pcb]);

    element().querySelector<HTMLElement>('.term-mention')?.click();
    fixture.detectChanges();

    expect(getTerm).toHaveBeenCalledWith(3);
    const dialog = element().querySelector('dialog') as HTMLElement;
    expect(dialog.querySelector('h2')?.textContent).toBe('PCB');
    expect(dialog.textContent).toContain('Process Control Block');
    expect(dialog.textContent).toContain('Bloc de contrôle du processus.');
    expect(link('Ouvrir dans le glossaire')?.getAttribute('href')).toBe('/glossaire/3');
  });

  it('propose, au clic droit dans le cours, de le modifier à cet endroit', async () => {
    await setup(COURSE);
    const content = fixture.debugElement.query(By.directive(CourseContent))
      .componentInstance as CourseContent;
    // jsdom ne calcule pas de mise en page : le clic vise le cinquième bloc.
    content.blockIndexAt = () => 4;
    const rightClick = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    element().querySelector('.article p')?.dispatchEvent(rightClick);
    fixture.detectChanges();

    expect(rightClick.defaultPrevented).toBe(true);
    expect(link('Modifier ici')?.getAttribute('href')).toBe('/ue/UTC502/cours/7/edition?bloc=4');

    document.body.click();
    fixture.detectChanges();
    expect(link('Modifier ici')).toBeUndefined();
  });

  function rightClickOnBlock(block: number): void {
    const content = fixture.debugElement.query(By.directive(CourseContent))
      .componentInstance as CourseContent;
    // jsdom ne calcule pas de mise en page : le clic vise le bloc de ce rang.
    content.blockIndexAt = () => block;
    element()
      .querySelector('.article p')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function menuButton(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll<HTMLButtonElement>('.context-menu button')).find(
      (candidate) => (candidate.textContent ?? '').trim() === label,
    );
  }

  it('marque la page sur la section du clic droit, et y pose le point', async () => {
    await setup(COURSE);
    setBookmark
      .mockReset()
      .mockReturnValue(of({ ...COURSE, bookmarkTitle: '2.1 fork', bookmarkBlock: 5 }));

    // Sixième bloc du cours : le paragraphe sous « 2.1 fork ».
    rightClickOnBlock(6);
    menuButton('Marquer ma page')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(setBookmark).toHaveBeenCalledWith(7, { title: '2.1 fork', block: 5 });
    expect(element().querySelector('.is-bookmarked')?.textContent).toBe('2.1 fork');
    expect(element().querySelector('.context-menu')).toBeNull();
  });

  it('propose de retirer le marque-page depuis une autre section, à côté de « Marquer ma page »', async () => {
    await setup({ ...COURSE, bookmarkTitle: '2. Création', bookmarkBlock: 3 });
    removeBookmark.mockReset().mockReturnValue(of(COURSE));

    rightClickOnBlock(6);
    expect(menuButton('Marquer ma page')).toBeDefined();
    menuButton('Retirer le marque-page')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(removeBookmark).toHaveBeenCalledWith(7);
  });

  it('propose de retirer le marque-page dans la section marquée', async () => {
    await setup({ ...COURSE, bookmarkTitle: '2. Création', bookmarkBlock: 3 });
    removeBookmark.mockReset().mockReturnValue(of(COURSE));

    rightClickOnBlock(4);
    expect(menuButton('Marquer ma page')).toBeUndefined();
    menuButton('Retirer le marque-page')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(removeBookmark).toHaveBeenCalledWith(7);
    expect(element().querySelector('.is-bookmarked')).toBeNull();
  });

  it('reprend la lecture au marque-page à l’ouverture du cours, pas dans sa fiche', async () => {
    const scrolled: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = function (this: Element): void {
      scrolled.push((this.textContent ?? '').trim());
    };
    // Le cours a été retouché depuis : le titre marqué est retrouvé par son texte.
    const marked = { ...COURSE, bookmarkTitle: '2.1 fork', bookmarkBlock: 9 };

    await setup(marked);
    expect(scrolled).toEqual(['2.1 fork']);
    expect(element().querySelector('.is-bookmarked')?.textContent).toBe('2.1 fork');

    TestBed.resetTestingModule();
    scrolled.length = 0;
    await setup(marked, 'fiche');
    expect(scrolled).toEqual([]);

    if (original) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', original);
    } else {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('reprend la lecture au bloc demandé au retour de l’édition (?bloc=n)', async () => {
    const scrolled: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = function (this: Element): void {
      scrolled.push((this.textContent ?? '').trim());
    };

    await setup(COURSE, undefined, [], '4');

    expect(scrolled).toEqual(['Détails.']);
    if (original) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', original);
    } else {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('laisse le menu du navigateur hors du cours', async () => {
    await setup(COURSE);
    const rightClick = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    element().querySelector('h1')?.dispatchEvent(rightClick);
    fixture.detectChanges();

    expect(rightClick.defaultPrevented).toBe(false);
    expect(link('Modifier ici')).toBeUndefined();
  });

  it('ouvre en grand l’image d’une figure, au clic comme au clavier', async () => {
    const figure: ContentNode = {
      type: 'figure',
      attrs: { src: '/api/courses/7/images/4', alt: 'États d’un processus' },
      content: [{ type: 'text', text: 'Figure 1 – états' }],
    };
    await setup(course(paragraph('Texte.'), figure));
    const viewer = TestBed.inject(ImageViewerService);
    const image = element().querySelector('figure img') as HTMLImageElement;
    expect(image.getAttribute('tabindex')).toBe('0');

    image.click();
    expect(viewer.image()).toEqual({
      src: '/api/courses/7/images/4',
      alt: 'États d’un processus',
      caption: 'Figure 1 – états',
    });

    viewer.close();
    image.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(viewer.image()?.src).toBe('/api/courses/7/images/4');
    viewer.close();
  });

  // Fiche rédigée : un document à part, avec ses propres titres.
  const SHEET: ContentNode = {
    type: 'doc',
    content: [
      heading(2, 'L’essentiel'),
      RETENIR,
      heading(2, 'À savoir refaire'),
      paragraph('fork'),
    ],
  };

  it('affiche la fiche de révision rédigée à la place du cours, avec son sommaire', async () => {
    await setup({ ...COURSE, sheetContent: SHEET }, 'fiche');

    expect(visibleBlocks()).toEqual([
      'L’essentiel',
      'Un programme est passif.',
      'À savoir refaire',
      'fork',
    ]);
    expect(outline()).toEqual(['L’essentiel', 'À savoir refaire']);
    expect(link('Cours complet')?.getAttribute('href')).toBe('/');
    expect(link('Modifier la fiche')?.getAttribute('href')).toBe(
      '/ue/UTC502/cours/7/fiche/edition',
    );
    expect(element().querySelector('.sheet-note')).not.toBeNull();
  });

  it('revient au cours complet quand la vue change', async () => {
    await setup({ ...COURSE, sheetContent: SHEET }, 'fiche');

    fixture.componentRef.setInput('vue', undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(visibleBlocks()).toHaveLength(9);
    expect(outline()).toHaveLength(4);
    expect(link('Modifier')?.getAttribute('href')).toBe('/ue/UTC502/cours/7/edition');
  });

  it('propose de rédiger la fiche d’un chapitre qui n’en a pas', async () => {
    await setup(COURSE, 'fiche');

    expect(element().querySelector('.ProseMirror')).toBeNull();
    expect(element().querySelector('.sheet-empty')?.textContent).toContain(
      'pas encore de fiche de révision',
    );
    expect(link('Rédiger la fiche')?.getAttribute('href')).toBe('/ue/UTC502/cours/7/fiche/edition');
  });

  it('ouvre l’édition de la fiche, au bon endroit, par le clic droit dans la fiche', async () => {
    await setup({ ...COURSE, sheetContent: SHEET }, 'fiche');

    rightClickOnBlock(3);

    expect(link('Modifier ici')?.getAttribute('href')).toBe(
      '/ue/UTC502/cours/7/fiche/edition?bloc=3',
    );
    // Le marque-page est celui du cours : il ne se pose pas dans la fiche.
    expect(menuButton('Marquer ma page')).toBeUndefined();
    expect(menuButton('Retirer le marque-page')).toBeUndefined();
  });

  it('annonce le nombre de sections et la date de modification', async () => {
    await setup(COURSE);

    const meta = element().querySelector('.heading .meta')?.textContent.replace(/\s+/g, ' ');
    expect(meta).toContain('UTC502');
    expect(meta).toMatch(/\d+ sections? · modifié le \d{2}\/\d{2}\/\d{4}/);
  });

  it('liste les termes issus du cours, les six premiers, avec un lien vers les autres', async () => {
    const terms = Array.from({ length: 8 }, (_, index): TermSummary => ({
      id: index + 1,
      type: index === 0 ? 'acronym' : 'definition',
      label: `Terme ${index + 1}`,
      expandedForm: index === 0 ? 'Forme développée' : null,
      excerpt: `Définition ${index + 1}`,
      ueCode: null,
      courseId: null,
      courseTitle: null,
    }));
    await setup(COURSE, undefined, terms);

    expect(listTerms).toHaveBeenCalledWith({ course: 7 });
    const items = Array.from(element().querySelectorAll('.terms li'));
    expect(items).toHaveLength(6);
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/glossaire/1');
    expect(items[0].querySelector('span')?.textContent).toBe('Forme développée');
    expect(items[1].querySelector('a')?.getAttribute('href')).toBe('/dictionnaire/2');
    expect(items[1].querySelector('span')?.textContent).toBe('Définition 2');
    expect(link('Voir les 8 termes')?.getAttribute('href')).toBe('/ue/UTC502?onglet=termes');
  });

  it('liste les commandes du chapitre et ouvre leur fiche dans une fenêtre', async () => {
    const groups: CommandGroup[] = [
      {
        tool: { id: 5, name: 'Shell Unix', modes: [], variants: [] },
        commands: [
          {
            id: 9,
            name: 'ps',
            summary: 'Liste les processus.',
            syntax: 'ps [-e]',
            modeId: null,
            variantIds: [],
            notes: '',
            themes: [],
            ueCodes: [],
            courses: [{ id: 7, title: 'Processus', ueCode: 'UTC502' }],
            options: [],
            examples: [],
            alsoIn: [],
          },
        ],
      },
    ];
    listCommands.mockReturnValue(of(groups));
    await setup(COURSE);

    const entry = element().querySelector<HTMLButtonElement>('.commands li button');
    expect(element().querySelector('.commands h3')?.textContent).toBe('Shell Unix');
    expect(entry?.textContent?.trim()).toBe('ps');

    entry?.click();
    fixture.detectChanges();

    const sheet = element().querySelector('app-modal app-command-sheet');
    expect(sheet?.querySelector('.syntax .token-name')?.textContent).toBe('ps');
    // La fiche se lit depuis le cours : on n'y supprime pas la commande.
    expect(sheet?.querySelector('button[aria-label="Supprimer ps"]')).toBeNull();
    listCommands.mockReturnValue(of([]));
  });

  it('n’affiche pas de colonne de termes pour un cours qui n’en a pas', async () => {
    await setup(COURSE);

    expect(element().querySelector('.terms h2')).toBeNull();
  });

  // Hauteur du document, que l'environnement de test ne calcule pas.
  function setPageHeight(height: number): void {
    Object.defineProperty(document.body, 'scrollHeight', { value: height, configurable: true });
  }

  // Place chaque titre à une hauteur de la fenêtre, puis signale un défilement.
  function scrollWithHeadingsAt(tops: number[]): void {
    const headings = Array.from(
      element().querySelectorAll<HTMLElement>('.ProseMirror h2, .ProseMirror h3'),
    );
    headings.forEach((heading, index) => {
      heading.getBoundingClientRect = () => ({ top: tops[index] }) as DOMRect;
    });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  }

  afterEach(() => Reflect.deleteProperty(document.body, 'scrollHeight'));

  it('met en avant dans le sommaire la section en cours de lecture', async () => {
    await setup(COURSE);
    setPageHeight(5000);

    // Le premier titre a passé la ligne de lecture, les autres sont plus bas.
    scrollWithHeadingsAt([40, 300, 500, 900]);

    const current = element().querySelector('.outline .is-current');
    expect(current?.textContent.trim()).toBe('1. Notion');
    expect(current?.getAttribute('aria-current')).toBe('location');
  });

  it('en bas de page, met en avant le dernier titre visible', async () => {
    await setup(COURSE);
    setPageHeight(window.innerHeight);

    // Aucun des derniers titres ne peut monter jusqu'à la ligne de lecture.
    scrollWithHeadingsAt([-400, 200, 350, window.innerHeight - 100]);

    expect(element().querySelector('.outline .is-current')?.textContent.trim()).toBe('3. Annexe');
  });

  it('garde marqué le titre choisi dans le sommaire, jusqu’à ce que l’utilisateur fasse défiler', async () => {
    await setup(COURSE);
    setPageHeight(5000);
    const entries = Array.from(element().querySelectorAll<HTMLButtonElement>('.outline button'));
    const current = (): string | undefined =>
      element().querySelector('.outline .is-current')?.textContent.trim();

    entries[2].click();
    // Le défilement vers le titre passe par d'autres sections sans changer le marquage.
    scrollWithHeadingsAt([40, 300, 500, 900]);
    expect(current()).toBe('2.1 fork');

    window.dispatchEvent(new Event('wheel'));
    scrollWithHeadingsAt([40, 300, 500, 900]);
    expect(current()).toBe('1. Notion');
  });
});
