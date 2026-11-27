import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { Modal } from '../../core/ui/modal';
import { CommandSheet } from '../outils/command-sheet';
import { Command, CommandGroup, CommandService, CommandTool } from '../outils/command.service';
import { Term, TermService, TermSummary } from '../termes/term.service';
import {
  Bookmark,
  findBookmarkBlock,
  headingRankOf,
  isInSection,
  sectionAt,
} from './bookmark/bookmark';
import { buildOutline } from './content/build-outline';
import { OpenedExercise } from './exercise/exercise';
import { AttemptSummary, ExerciseAttemptsService } from './exercise/exercise-attempts.service';
import { ExerciseWorkspace } from './exercise/exercise-workspace';
import { CheckedQuiz, CourseContent } from './content/course-content';
import { CourseOutline } from './content/course-outline';
import { CourseRemoval } from './course-removal';
import { Course, CourseService } from './course.service';

const SHOWN_TERMS = 6;
// Hauteur, dans la fenêtre, sous laquelle un titre ouvre la section en cours de lecture.
const READING_LINE_PX = 160;
// Place à garder à droite du menu du clic droit pour qu'il ne sorte pas de la fenêtre.
const MENU_WIDTH_PX = 200;

@Component({
  selector: 'app-course-read-page',
  imports: [
    CommandSheet,
    CourseContent,
    CourseOutline,
    DatePipe,
    ExerciseWorkspace,
    Icon,
    Modal,
    RouterLink,
  ],
  host: {
    '(window:scroll)': 'followReading()',
    // L'utilisateur reprend la main sur le défilement.
    '(window:wheel)': 'releaseHeading()',
    '(window:touchmove)': 'releaseHeading()',
    '(window:keydown)': 'releaseHeading()',
    '(window:keydown.escape)': 'closePanels()',
    '(window:contextmenu)': 'openContextMenu($event)',
    '(window:click)': 'contextMenu.set(null)',
  },
  templateUrl: './course-read-page.html',
  styleUrl: './course-read-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseReadPage {
  // Paramètres de la route /ue/:code/cours/:id.
  readonly code = input.required<string>();
  readonly id = input.required<string>();
  // Paramètre de requête ?vue=fiche : la fiche de révision du cours, à la place du cours.
  readonly vue = input<string>();
  // Paramètre de requête ?bloc=n : rang du bloc où reprendre la lecture, au retour de
  // l'édition ouverte par « Modifier ici ».
  readonly bloc = input<string>();

  private readonly courseService = inject(CourseService);
  private readonly attemptsService = inject(ExerciseAttemptsService);
  private readonly courseRemoval = inject(CourseRemoval);
  private readonly termService = inject(TermService);
  private readonly commandService = inject(CommandService);
  private readonly title = inject(Title);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly contentView = viewChild(CourseContent);
  private readonly article = viewChild<ElementRef<HTMLElement>>('article');
  private readonly menuItem = viewChild<ElementRef<HTMLElement>>('menuItem');

  protected readonly course = signal<Course | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly isSheet = computed(() => this.vue() === 'fiche');
  // Rang du titre qui porte le marque-page de lecture ; null sans marque-page, ou si le
  // titre marqué n'existe plus.
  protected readonly bookmarkBlock = computed(() => {
    const course = this.course();
    if (!course || course.bookmarkTitle === null || course.bookmarkBlock === null) {
      return null;
    }
    return findBookmarkBlock(course.content, {
      title: course.bookmarkTitle,
      block: course.bookmarkBlock,
    });
  });
  // Rang, dans le sommaire, du titre qui porte le marque-page ; null sans marque-page, et
  // dans la fiche de révision, qui a son propre sommaire.
  protected readonly bookmarkHeading = computed(() => {
    const course = this.course();
    const block = this.bookmarkBlock();
    return course && block !== null && !this.isSheet()
      ? headingRankOf(course.content, block)
      : null;
  });
  // Bloc amené à l'écran à l'ouverture : celui demandé au retour de l'édition, sinon le
  // marque-page. La fiche de révision, elle, s'ouvre à son début.
  protected readonly startBlock = computed(() => {
    const rank = Number(this.bloc());
    if (this.bloc() !== undefined && Number.isInteger(rank) && rank >= 0) {
      return rank;
    }
    return this.isSheet() ? null : this.bookmarkBlock();
  });
  // Section visée par le clic droit, où le marque-page se poserait ; null hors du texte,
  // dans la fiche, ou pour un cours sans titre.
  protected readonly menuSection = computed<Bookmark | null>(() => {
    const course = this.course();
    const block = this.contextMenu()?.block ?? null;
    return course && block !== null && !this.isSheet() ? sectionAt(course.content, block) : null;
  });
  // Document affiché : le cours, ou sa fiche de révision ; null pour une fiche qui
  // n'est pas encore rédigée.
  protected readonly shownContent = computed(() => {
    const course = this.course();
    if (!course) {
      return null;
    }
    return this.isSheet() ? course.sheetContent : course.content;
  });
  // Page d'édition du document affiché.
  protected readonly editLink = computed(() => [
    '/ue',
    this.code(),
    'cours',
    Number(this.id()),
    ...(this.isSheet() ? ['fiche', 'edition'] : ['edition']),
  ]);
  // Sommaire du document affiché.
  protected readonly outline = computed(() => {
    const content = this.shownContent();
    return content ? buildOutline(content) : [];
  });
  protected readonly sectionCount = computed(
    () => this.outline().filter((entry) => entry.level === 2).length,
  );
  // Titre de la section en cours de lecture, mis en avant dans le sommaire.
  protected readonly activeHeading = signal<number | null>(null);
  // « Revenir à ma page » : proposé quand la lecture a quitté le chapitre marqué, tant
  // qu'on ne l'a pas écarté. Le retour après un renvoi (returnPosition) passe avant.
  protected readonly isBookmarkBarHidden = signal(false);
  protected readonly canReturnToBookmark = computed(() => {
    const marked = this.bookmarkHeading();
    return (
      marked !== null &&
      !this.isBookmarkBarHidden() &&
      this.returnPosition() === null &&
      !isInSection(this.outline(), marked, this.activeHeading())
    );
  });
  // Titre choisi dans le sommaire, que le défilement qui s'ensuit ne doit pas démarquer.
  private chosenHeading: number | null = null;
  // Sur écran étroit, le sommaire est rétracté : true quand il est sorti.
  protected readonly isOutlineOpen = signal(false);
  // Menu ouvert par un clic droit dans le cours : où l'afficher dans la fenêtre, et le
  // rang du bloc visé, où l'édition s'ouvrira.
  protected readonly contextMenu = signal<{
    top: number;
    left: number;
    block: number | null;
  } | null>(null);
  // Hauteur de page quittée en suivant un renvoi vers une section ; null sinon.
  protected readonly returnPosition = signal<number | null>(null);
  // Termes issus de ce cours ; la colonne n'en montre que les premiers.
  protected readonly terms = signal<TermSummary[]>([]);
  protected readonly shownTerms = computed(() => this.terms().slice(0, SHOWN_TERMS));
  // Tous les termes de l'UE : ceux que le texte cite y deviennent cliquables.
  protected readonly allTerms = signal<TermSummary[]>([]);
  // Historique d'un QCM, affiché dans une fenêtre ; null quand elle est fermée.
  protected readonly quizHistory = signal<AttemptSummary[] | null>(null);
  // Exercice ouvert dans sa fenêtre de travail.
  protected readonly exercise = signal<OpenedExercise | null>(null);
  // Terme dont la définition est affichée dans une fenêtre ; null quand elle est fermée.
  protected readonly shownTerm = signal<Term | null>(null);
  // Commandes étiquetées avec ce cours, rangées sous leur outil.
  protected readonly commandGroups = signal<CommandGroup[]>([]);
  // Commande dont la fiche est affichée dans une fenêtre ; null quand elle est fermée.
  protected readonly shownCommand = signal<{ command: Command; tool: CommandTool } | null>(null);
  constructor() {
    effect(() => this.load(Number(this.id())));
    // Le menu ouvert reçoit le curseur : il se parcourt et se valide au clavier.
    effect(() => this.menuItem()?.nativeElement.focus());
  }

  protected closePanels(): void {
    this.isOutlineOpen.set(false);
    this.contextMenu.set(null);
  }

  // Clic droit dans le cours : propose de le modifier à cet endroit. Avec du texte
  // sélectionné, le menu du navigateur (copier) garde la main.
  protected openContextMenu(event: MouseEvent): void {
    const isInCourse =
      event.target instanceof Node && this.article()?.nativeElement.contains(event.target);
    if (!isInCourse || window.getSelection()?.isCollapsed === false) {
      this.contextMenu.set(null);
      return;
    }
    event.preventDefault();
    this.contextMenu.set({
      top: event.clientY,
      left: Math.min(event.clientX, window.innerWidth - MENU_WIDTH_PX),
      block: this.contentView()?.blockIndexAt(event.clientX, event.clientY) ?? null,
    });
  }

  // Pose le marque-page sur la section du clic droit, ou le retire (null).
  protected markPage(bookmark: Bookmark | null): void {
    const course = this.course();
    this.contextMenu.set(null);
    if (!course) {
      return;
    }
    const request = bookmark
      ? this.courseService.setBookmark(course.id, bookmark)
      : this.courseService.removeBookmark(course.id);
    request.subscribe({
      // Seul le marque-page change : le contenu affiché reste le même objet, la lecture
      // ne bouge pas.
      next: ({ bookmarkTitle, bookmarkBlock }) => {
        this.course.update((shown) => shown && { ...shown, bookmarkTitle, bookmarkBlock });
        // Un marque-page posé ailleurs remet « Revenir à ma page » en jeu.
        this.isBookmarkBarHidden.set(false);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  // Un titre devient celui de la section en cours dès qu'il passe la ligne de lecture.
  protected followReading(): void {
    // Le menu du clic droit ne suit pas la page : il se ferme dès qu'elle défile.
    this.contextMenu.set(null);
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

  // Ramène la lecture au titre qui porte le marque-page.
  protected goToBookmark(): void {
    const marked = this.bookmarkHeading();
    if (marked !== null) {
      this.goTo(marked);
    }
  }

  protected releaseHeading(): void {
    this.chosenHeading = null;
  }

  protected goTo(index: number): void {
    this.isOutlineOpen.set(false);
    this.chosenHeading = index;
    this.activeHeading.set(index);
    this.contentView()?.scrollToHeading(index);
  }

  // Ouvre la définition complète d'un terme cité dans le texte.
  // Garde le score du QCM qui vient d'être validé ; un échec ne gêne pas la lecture.
  protected recordQuiz(courseId: number, quiz: CheckedQuiz): void {
    this.attemptsService
      .submitQuiz(courseId, quiz.key, quiz.right, quiz.total)
      .subscribe({ error: () => undefined });
  }

  protected showQuizHistory(courseId: number, key: string): void {
    this.attemptsService.progress(courseId, key).subscribe({
      next: (progress) => this.quizHistory.set(progress.attempts),
      error: () => this.quizHistory.set([]),
    });
  }

  protected openTerm(id: number): void {
    this.termService.get(id).subscribe({
      next: (term) => this.shownTerm.set(term),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  // Suit un renvoi vers une section, en retenant d'où l'on part : plusieurs renvois
  // suivis à la file ramènent au premier endroit quitté.
  protected followReference(headingIndex: number): void {
    if (this.returnPosition() === null) {
      this.returnPosition.set(window.scrollY);
    }
    this.goTo(headingIndex);
  }

  protected goBack(): void {
    const top = this.returnPosition();
    if (top !== null) {
      this.returnPosition.set(null);
      this.chosenHeading = null;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  protected async remove(course: Course): Promise<void> {
    try {
      if (await this.courseRemoval.remove(course)) {
        void this.router.navigate(['/ue', this.code()]);
      }
    } catch (error) {
      this.errors.set((error as ApiError).messages);
    }
  }
  private load(id: number): void {
    this.returnPosition.set(null);
    this.shownTerm.set(null);
    this.course.set(null);
    this.terms.set([]);
    this.commandGroups.set([]);
    this.shownCommand.set(null);
    this.activeHeading.set(null);
    this.chosenHeading = null;
    this.isBookmarkBarHidden.set(false);
    // Les termes sont un complément : leur échec ne bloque pas la lecture.
    this.termService.list({ course: id }).subscribe({
      next: (terms) => this.terms.set(terms),
      error: () => undefined,
    });
    this.commandService.listByCourse(id).subscribe({
      next: (groups) => this.commandGroups.set(groups),
      error: () => undefined,
    });
    this.termService.list({ ue: this.code() }).subscribe({
      next: (terms) => this.allTerms.set(terms),
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
