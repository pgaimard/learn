import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { TERM_SCREENS } from '../termes/term-screens';
import { TermService, TermSummary } from '../termes/term.service';
import { buildOutline } from './content/build-outline';
import { hasSheetContent, sheetHeadingIndexes } from './revision/revision-sheet';
import { CourseContent } from './content/course-content';
import { CourseOutline } from './content/course-outline';
import { Course, CourseService } from './course.service';

const SHOWN_TERMS = 6;
// Hauteur, dans la fenêtre, sous laquelle un titre ouvre la section en cours de lecture.
const READING_LINE_PX = 160;

@Component({
  selector: 'app-course-read-page',
  imports: [CourseContent, CourseOutline, DatePipe, Icon, RouterLink],
  host: {
    '(window:scroll)': 'followReading()',
    // L'utilisateur reprend la main sur le défilement.
    '(window:wheel)': 'releaseHeading()',
    '(window:touchmove)': 'releaseHeading()',
    '(window:keydown)': 'releaseHeading()',
  },
  templateUrl: './course-read-page.html',
  styleUrl: './course-read-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseReadPage {
  // Paramètres de la route /ue/:code/cours/:id.
  readonly code = input.required<string>();
  readonly id = input.required<string>();
  // Paramètre de requête ?vue=fiche : le cours réduit à sa fiche de révision.
  readonly vue = input<string>();

  private readonly courseService = inject(CourseService);
  private readonly termService = inject(TermService);
  private readonly title = inject(Title);
  private readonly contentView = viewChild(CourseContent);

  protected readonly course = signal<Course | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly isSheet = computed(() => this.vue() === 'fiche');
  // Sommaire du cours, réduit aux titres de la fiche quand elle est affichée.
  protected readonly outline = computed(() => {
    const course = this.course();
    if (!course) {
      return [];
    }
    const entries = buildOutline(course.content);
    if (!this.isSheet()) {
      return entries;
    }
    const kept = sheetHeadingIndexes(course.content);
    return entries.filter((entry) => kept.has(entry.index));
  });
  protected readonly sectionCount = computed(
    () => this.outline().filter((entry) => entry.level === 2).length,
  );
  // Titre de la section en cours de lecture, mis en avant dans le sommaire.
  protected readonly activeHeading = signal<number | null>(null);
  // Titre choisi dans le sommaire, que le défilement qui s'ensuit ne doit pas démarquer.
  private chosenHeading: number | null = null;
  // Termes issus de ce cours ; la colonne n'en montre que les premiers.
  protected readonly terms = signal<TermSummary[]>([]);
  protected readonly shownTerms = computed(() => this.terms().slice(0, SHOWN_TERMS));
  protected readonly isSheetEmpty = computed(() => {
    const course = this.course();
    return this.isSheet() && !!course && !hasSheetContent(course.content);
  });

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  protected termPath(term: TermSummary): string {
    return TERM_SCREENS[term.type].path;
  }

  // Un titre devient celui de la section en cours dès qu'il passe la ligne de lecture.
  protected followReading(): void {
    // Un titre choisi dans le sommaire reste marqué pendant que la page y défile, et
    // tant que l'utilisateur ne fait pas défiler lui-même.
    if (this.chosenHeading !== null) {
      this.activeHeading.set(this.chosenHeading);
      return;
    }
    // En bas de page, les derniers titres ne peuvent plus monter jusqu'à la ligne de
    // lecture : le dernier titre visible est alors celui de la section en cours.
    const isAtBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
    const line = isAtBottom ? window.innerHeight : READING_LINE_PX;
    this.activeHeading.set(this.contentView()?.headingIndexAbove(line) ?? null);
  }

  protected releaseHeading(): void {
    this.chosenHeading = null;
  }

  protected goTo(index: number): void {
    this.chosenHeading = index;
    this.activeHeading.set(index);
    this.contentView()?.scrollToHeading(index);
  }

  private load(id: number): void {
    this.course.set(null);
    this.terms.set([]);
    this.activeHeading.set(null);
    this.chosenHeading = null;
    // Les termes sont un complément : leur échec ne bloque pas la lecture.
    this.termService.list({ course: id }).subscribe({
      next: (terms) => this.terms.set(terms),
      error: () => undefined,
    });
    this.courseService.get(id).subscribe({
      next: (course) => {
        this.course.set(course);
        this.title.setTitle(course.title);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
