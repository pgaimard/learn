import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContentNode } from './content/content-node';
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

  async function setup(shown: Course, view?: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: { get: () => of(shown) } },
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
});
