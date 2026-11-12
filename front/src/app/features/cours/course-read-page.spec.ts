import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ImageViewerService } from '../../core/ui/image-viewer.service';
import { ContentNode } from './content/content-node';
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

  async function setup(shown: Course, view?: string, terms: TermSummary[] = []): Promise<void> {
    listTerms.mockReset().mockReturnValue(of(terms));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: { get: () => of(shown) } },
        { provide: TermService, useValue: { list: listTerms } },
      ],
    });
    fixture = TestBed.createComponent(CourseReadPage);
    fixture.componentRef.setInput('code', 'UTC502');
    fixture.componentRef.setInput('id', '7');
    fixture.componentRef.setInput('vue', view);
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

  // Textes des blocs de premier niveau restés visibles.
  function visibleBlocks(): string[] {
    return Array.from(element().querySelectorAll('.ProseMirror > *'))
      .filter((block) => !block.classList.contains('is-off-sheet'))
      .map((block) => (block.textContent ?? '').trim());
  }

  function link(label: string): HTMLAnchorElement | undefined {
    return Array.from(element().querySelectorAll('a')).find(
      (candidate) => (candidate.textContent ?? '').trim() === label,
    );
  }

  it('affiche le cours complet et propose la fiche de révision', async () => {
    await setup(COURSE);

    expect(visibleBlocks()).toHaveLength(9);
    expect(outline()).toEqual(['1. Notion', '2. Création', '2.1 fork', '3. Annexe']);
    expect(link('Fiche de révision')?.getAttribute('href')).toBe('/?vue=fiche');
    expect(element().querySelector('.sheet-note')).toBeNull();
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

  it('réduit le cours à sa fiche : encadrés « À retenir », blocs épinglés et leurs titres', async () => {
    await setup(COURSE, 'fiche');

    expect(visibleBlocks()).toEqual([
      '1. Notion',
      'Un programme est passif.',
      '2. Création',
      '2.1 fork',
      'Appel épinglé.',
    ]);
    expect(outline()).toEqual(['1. Notion', '2. Création', '2.1 fork']);
    expect(link('Cours complet')?.getAttribute('href')).toBe('/');
    expect(element().querySelector('.sheet-note')).not.toBeNull();
  });

  it('revient au cours complet quand la vue change', async () => {
    await setup(COURSE, 'fiche');

    fixture.componentRef.setInput('vue', undefined);
    fixture.detectChanges();

    expect(visibleBlocks()).toHaveLength(9);
    expect(outline()).toHaveLength(4);
  });

  it('explique comment remplir une fiche vide', async () => {
    await setup(course(heading(2, 'Titre'), paragraph('Texte.')), 'fiche');

    expect(visibleBlocks()).toEqual([]);
    expect(element().querySelector('.sheet-empty')?.textContent).toContain('épinglez un bloc');
  });

  it('ne signale pas de fiche vide sur le cours complet', async () => {
    await setup(course(heading(2, 'Titre'), paragraph('Texte.')));

    expect(element().querySelector('.sheet-empty')).toBeNull();
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
