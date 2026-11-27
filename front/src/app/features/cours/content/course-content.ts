import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { ImageViewerService } from '../../../core/ui/image-viewer.service';
import { SlideshowViewerService, ViewedSlideshow } from '../../../core/ui/slideshow-viewer.service';
import { OpenedExercise, openedExercise } from '../exercise/exercise';
import { applyChecked, QuizScore } from '../quiz/quiz-answers';
import { MAX_SLIDES, selectSlideText, slideshowAtSelection } from '../slideshow/slideshow';
import { setBookmarkBlock } from '../bookmark/bookmark-mark';
import { ContentNode } from './content-node';
import { revealPosition } from '../editor/sections/section-folding';
import { SlashMenuState } from '../editor/slash/slash-menu-state';
import { CodeBlockTarget } from '../editor/selection/selection-watcher';
import { createCourseExtensions } from './course-extensions';
import { MentionTerm, setMentionTerms } from './term-mentions';

// Affiche un contenu (cours ou définition d'un terme) avec le moteur de l'éditeur : le rendu est le même
// en lecture et en édition, et le contenu n'est jamais injecté comme du HTML.
// QCM dont une case vient de changer : sa clé dans le cours et ses cases cochées.
export interface ChangedQuiz {
  key: string;
  checked: boolean[][];
}

// QCM validé en lecture : sa clé dans le cours et son score.
export interface CheckedQuiz extends QuizScore {
  key: string;
}

@Component({
  selector: 'app-course-content',
  template: '',
  host: {
    class: 'course-content',
    '[class.is-editable]': 'editable()',
    '(click)': 'activate($event)',
    '(keydown.enter)': 'activate($event)',
    '(quizchecked)': 'onQuizChecked($event)',
    '(quizhistory)': 'onQuizHistory($event)',
    '(quizchanged)': 'onQuizChanged($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseContent {
  readonly content = input.required<ContentNode>();
  readonly editable = input(false);
  // Nom accessible de la zone de contenu.
  readonly label = input('Contenu du cours');
  // Rang du bloc de premier niveau à amener au milieu de l'écran à l'ouverture ; en
  // édition, le curseur s'y place.
  readonly startBlock = input<number | null>(null);

  // Rang du bloc (un titre) qui porte le marque-page de lecture ; null sans marque-page.
  readonly bookmarkBlock = input<number | null>(null);

  // Cases cochées des QCM commencés puis quittés, par clé : elles sont remises en place.
  readonly quizDrafts = input<Record<string, boolean[][]>>({});

  // Termes à rendre cliquables dans le texte, en lecture.
  readonly terms = input<MentionTerm[]>([]);

  // Émis à chaque modification faite par l'utilisateur.
  readonly edited = output();
  // Émis pour chaque image collée ou déposée ; l'envoi est fait par la page.
  readonly imageReceived = output<File>();
  // Émis en lecture quand un renvoi vers une section est suivi : le rang du titre visé.
  readonly sectionReferenced = output<number>();
  // Émis en lecture quand un terme cité dans le texte est choisi : son identifiant.
  readonly termOpened = output<number>();
  // Émis en lecture quand un QCM est validé : sa clé et son score.
  readonly quizChecked = output<CheckedQuiz>();
  // Émis en lecture à chaque case cochée ou décochée d'un QCM : sa clé et ses cases.
  readonly quizChanged = output<ChangedQuiz>();
  // Émis en lecture quand l'historique d'un QCM est demandé : sa clé.
  readonly quizHistoryRequested = output<string>();
  // Émis en lecture par « Faire l'exercice » : son énoncé et son corrigé.
  readonly exerciseOpened = output<OpenedExercise>();

  // L'éditeur n'existe qu'après le premier rendu ; la barre d'outils s'y branche.
  readonly editor = signal<Editor | null>(null);
  // Bloc dont le menu est ouvert : sa position dans le document et la hauteur où
  // afficher le menu, en pixels depuis le haut du conteneur de ce composant.
  readonly blockMenu = signal<{ pos: number; top: number } | null>(null);
  // Menu de tableau ouvert par un clic droit : où l'afficher, dans le même repère.
  readonly tableMenu = signal<{ top: number; left: number } | null>(null);
  // Choix d'un tableau à insérer, appelé par le menu « / » : où l'afficher, dans le même repère.
  readonly tablePicker = signal<{ top: number; left: number } | null>(null);
  // Barre de mise en forme de la sélection : où l'afficher, dans le même repère.
  readonly selectionBar = signal<{ top: number; left: number } | null>(null);
  // Barre du bloc de code où se trouve le curseur : le bloc et son coin haut gauche.
  readonly codeBlockBar = signal<CodeBlockTarget | null>(null);
  // Menu « / » d'insertion de bloc.
  readonly slash = new SlashMenuState(
    () => this.editor(),
    () => this.pickImages(),
    () => this.pickSlideshow(),
    (place) => this.tablePicker.set(place),
  );

  // Les prochaines images reçues ouvrent un diaporama au lieu de s'insérer seules.
  private slideshowPending = false;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly slideshowViewer = inject(SlideshowViewerService);

  constructor() {
    afterNextRender(() => {
      this.editor.set(
        new Editor({
          element: this.host.nativeElement,
          extensions: createCourseExtensions({
            blockHandle: {
              onOpenMenu: ({ pos, top }) =>
                this.blockMenu.set({ pos, top: top + this.host.nativeElement.offsetTop }),
              hoverZone: () => this.host.nativeElement.parentElement,
            },
            tableTools: {
              onOpenMenu: ({ top, left }) =>
                this.tableMenu.set({
                  top: top + this.host.nativeElement.offsetTop,
                  left: left + this.host.nativeElement.offsetLeft,
                }),
            },
            selection: {
              onChange: (target) => this.selectionBar.set(this.offset(target)),
              onCodeBlock: (target) => {
                const place = this.offset(target);
                this.codeBlockBar.set(target && place ? { ...target, ...place } : null);
              },
            },
            slash: {
              onChange: (trigger) => {
                const place = this.offset(trigger);
                this.slash.show(trigger && place ? { ...trigger, ...place } : null);
              },
              onKey: (key) => this.slash.handleKey(key),
            },
          }),
          content: untracked(this.content),
          editable: untracked(this.editable),
          editorProps: {
            attributes: { 'aria-label': untracked(this.label) },
            handlePaste: (_view, event) => this.receiveImages(event.clipboardData),
            handleDrop: (view, event) => {
              const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (position && hasImages(event.dataTransfer)) {
                this.editor()?.commands.setTextSelection(position.pos);
              }
              return this.receiveImages(event.dataTransfer);
            },
          },
          onUpdate: ({ transaction }) => {
            // Une retouche que l'éditeur fait seul (paragraphe final ajouté au premier
            // clic, par exemple) n'est pas une modification de l'utilisateur.
            if (!transaction.docChanged) {
              return;
            }
            this.blockMenu.set(null);
            this.tableMenu.set(null);
            this.edited.emit();
          },
        }),
      );
      this.focusBlock(untracked(this.startBlock));
    });
    // Les QCM commencés retrouvent leurs cases, une fois le cours dessiné.
    effect(() => {
      const drafts = this.quizDrafts();
      if (this.editor() && !this.editable()) {
        for (const [key, checked] of Object.entries(drafts)) {
          const quiz = this.quizElement(key);
          if (quiz) {
            applyChecked(quiz, checked);
          }
        }
      }
    });
    effect(() => {
      const content = this.content();
      // emitUpdate à false : charger un contenu n'est pas une modification de l'utilisateur.
      untracked(this.editor)?.commands.setContent(content, { emitUpdate: false });
    });
    effect(() => {
      const terms = this.terms();
      const view = this.editor()?.view;
      if (view) {
        setMentionTerms(view, terms);
      }
    });
    effect(() => {
      const block = this.bookmarkBlock();
      // Le contenu est relu : le marque-page se repose après un changement de cours.
      this.content();
      const view = this.editor()?.view;
      if (view) {
        setBookmarkBlock(view, block);
      }
    });
    effect(() => {
      const editable = this.editable();
      untracked(this.editor)?.setEditable(editable, false);
    });
    inject(DestroyRef).onDestroy(() => this.editor()?.destroy());
  }

  protected onQuizChecked(event: Event): void {
    const key = this.quizKey(event.target);
    const score = event instanceof CustomEvent ? (event.detail as QuizScore) : null;
    if (key && score) {
      this.quizChecked.emit({ key, ...score });
    }
  }

  protected onQuizChanged(event: Event): void {
    const key = this.quizKey(event.target);
    if (key && event instanceof CustomEvent) {
      this.quizChanged.emit({ key, checked: event.detail as boolean[][] });
    }
  }

  // Écrit, dans le pied du QCM, où en est l'enregistrement de ses réponses en cours.
  setQuizStatus(key: string, status: string): void {
    const saved = this.quizElement(key)?.querySelector('.quiz-saved');
    if (saved) {
      saved.textContent = status;
    }
  }

  private quizElement(key: string): HTMLElement | null {
    const quizzes = this.host.nativeElement.querySelectorAll<HTMLElement>('.quiz');
    return quizzes[Number(key.replace('qcm-', '')) - 1] ?? null;
  }

  protected onQuizHistory(event: Event): void {
    const key = this.quizKey(event.target);
    if (key) {
      this.quizHistoryRequested.emit(key);
    }
  }

  // Un QCM est désigné par son rang parmi ceux du document : « qcm-1 », « qcm-2 »…
  private quizKey(target: EventTarget | null): string | null {
    const quizzes = Array.from(this.host.nativeElement.querySelectorAll('.quiz'));
    const rank = target instanceof Element ? quizzes.indexOf(target) : -1;
    return rank < 0 ? null : `qcm-${rank + 1}`;
  }

  // Retrouve dans le document l'exercice dessiné par cet élément, et le fait ouvrir.
  private openExercise(element: HTMLElement): void {
    const editor = this.editor();
    if (!editor) {
      return;
    }
    const $pos = editor.state.doc.resolve(editor.view.posAtDOM(element, 0));
    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);
      if (node.type.name === 'exercise') {
        this.exerciseOpened.emit(openedExercise(node));
        return;
      }
    }
  }

  // En lecture, un clic (ou Entrée) suit un renvoi vers une section, ouvre la définition
  // d'un terme cité, ouvre un diaporama, ou ouvre en grand l'image d'une figure.
  protected activate(event: Event): void {
    const image = event.target;
    if (this.editable() || !(image instanceof Element)) {
      return;
    }
    const reference = image.closest<HTMLElement>('.section-ref');
    if (reference) {
      event.preventDefault();
      this.sectionReferenced.emit(Number(reference.dataset['heading']));
      return;
    }
    const mention = image.closest<HTMLElement>('.term-mention');
    if (mention) {
      event.preventDefault();
      this.termOpened.emit(Number(mention.dataset['termId']));
      return;
    }
    const exercise = image.closest('.exercise-open')?.closest<HTMLElement>('.exercise');
    if (exercise) {
      event.preventDefault();
      this.openExercise(exercise);
      return;
    }
    const slideshow = image.closest<HTMLElement>('.slideshow');
    if (slideshow) {
      event.preventDefault();
      this.slideshowViewer.open(readSlideshow(slideshow));
      return;
    }
    if (!(image instanceof HTMLImageElement)) {
      return;
    }
    const figure = image.closest('figure');
    if (figure) {
      this.imageViewer.open({
        src: image.getAttribute('src') ?? '',
        alt: image.alt,
        caption: figure.querySelector('figcaption')?.textContent.trim() ?? '',
      });
    }
  }

  // Ouvre le choix de fichiers du navigateur ; les images choisies suivent le même
  // chemin que celles collées ou déposées.
  private pickImages(): void {
    this.slideshowPending = false;
    this.chooseImages();
  }

  // Choix des images d'un nouveau diaporama : une par étape, dans l'ordre des fichiers.
  pickSlideshow(): void {
    this.slideshowPending = true;
    this.chooseImages();
  }

  private chooseImages(): void {
    const field = document.createElement('input');
    field.type = 'file';
    field.accept = 'image/png,image/jpeg,image/svg+xml';
    field.multiple = true;
    field.addEventListener('change', () => {
      for (const file of Array.from(field.files ?? [])) {
        this.imageReceived.emit(file);
      }
    });
    // Choix abandonné : les images suivantes ne doivent pas ouvrir un diaporama.
    field.addEventListener('cancel', () => (this.slideshowPending = false));
    field.click();
  }

  // Passe du repère de ce composant à celui de son conteneur.
  private offset(target: { top: number; left: number } | null): typeof target {
    return (
      target && {
        top: target.top + this.host.nativeElement.offsetTop,
        left: target.left + this.host.nativeElement.offsetLeft,
      }
    );
  }

  // Rang du bloc de premier niveau affiché à cet endroit de la fenêtre ; null hors du texte.
  blockIndexAt(left: number, top: number): number | null {
    const view = this.editor()?.view;
    const found = view?.posAtCoords({ left, top });
    if (!view || !found) {
      return null;
    }
    const { doc } = view.state;
    return Math.min(doc.resolve(found.pos).index(0), doc.childCount - 1);
  }

  // Amène le bloc de ce rang au milieu de l'écran ; en édition, y place le curseur.
  private focusBlock(index: number | null): void {
    const editor = this.editor();
    if (!editor || index === null || index < 0 || index >= editor.state.doc.childCount) {
      return;
    }
    let pos = 0;
    for (let rank = 0; rank < index; rank++) {
      pos += editor.state.doc.child(rank).nodeSize;
    }
    if (editor.isEditable) {
      editor.commands.focus(pos + 1, { scrollIntoView: false });
    }
    const block = editor.view.nodeDOM(pos);
    if (block instanceof HTMLElement && typeof block.scrollIntoView === 'function') {
      block.scrollIntoView({ block: 'center' });
    }
  }

  getContent(): ContentNode {
    return (this.editor()?.getJSON() ?? this.content()) as ContentNode;
  }

  insertFigure(src: string, alt: string): void {
    const editor = this.editor();
    if (!editor) {
      return;
    }
    const figure = { type: 'figure', attrs: { src, alt } };
    if (this.insertSlide(editor, figure)) {
      return;
    }
    if (!editor.isActive('figure')) {
      editor.chain().focus().insertContent(figure).run();
      return;
    }
    // Curseur déjà sur une image (ou dans sa légende) : la nouvelle se place après,
    // au lieu de la remplacer.
    const { $to, to } = editor.state.selection;
    const position = $to.parent.type.name === 'figure' ? $to.after() : to;
    editor.chain().focus().insertContentAt(position, figure).run();
  }

  // Une image reçue pendant qu'on compose un diaporama devient une étape : la première
  // ouvre le diaporama après le bloc du curseur, les suivantes s'ajoutent après l'étape
  // du curseur. Renvoie false quand l'image doit s'insérer comme une figure ordinaire.
  private insertSlide(editor: Editor, figure: ContentNode): boolean {
    const slide = { type: 'slide', content: [figure, { type: 'paragraph' }] };
    const current = slideshowAtSelection(editor.state);
    if (current) {
      if (current.count >= MAX_SLIDES) {
        return true;
      }
      editor.chain().focus().insertContentAt(current.afterSlide, slide).run();
      editor.view.dispatch(selectSlideText(editor.state.tr, current.afterSlide));
      return true;
    }
    if (!this.slideshowPending) {
      return false;
    }
    this.slideshowPending = false;
    const { $from } = editor.state.selection;
    const position = $from.depth > 0 ? $from.after(1) : editor.state.doc.content.size;
    editor
      .chain()
      .focus()
      .insertContentAt(position, { type: 'slideshow', content: [slide] })
      .run();
    // Le curseur entre dans l'étape : les images suivantes s'ajouteront après elle.
    editor.view.dispatch(selectSlideText(editor.state.tr, position + 1));
    return true;
  }

  // Renvoie true quand des images ont été prises en charge, pour bloquer le traitement
  // par défaut (qui insérerait l'image encodée dans le contenu).
  private receiveImages(transfer: DataTransfer | null): boolean {
    if (!this.editable() || !hasImages(transfer)) {
      return false;
    }
    for (const file of imagesOf(transfer)) {
      this.imageReceived.emit(file);
    }
    return true;
  }

  // Rang du dernier titre passé au-dessus de la hauteur donnée (dans la fenêtre) : celui
  // de la section en cours de lecture. null avant le premier titre.
  headingIndexAbove(limit: number): number | null {
    const headings = this.host.nativeElement.querySelectorAll<HTMLElement>('h2, h3, h4, h5');
    let current: number | null = null;
    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= limit) {
        current = index;
      }
    });
    return current;
  }

  scrollToHeading(index: number): void {
    const headings = this.host.nativeElement.querySelectorAll<HTMLElement>('h2, h3, h4, h5');
    const heading = headings.item(index) as HTMLElement | null;
    const view = this.editor()?.view;
    if (heading && view) {
      // Le titre visé peut se trouver dans un chapitre replié.
      revealPosition(view, view.posAtDOM(heading, 0));
    }
    if (heading) {
      heading.tabIndex = -1;
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      heading.focus({ preventScroll: true });
    }
  }
}

function imagesOf(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
}

function hasImages(transfer: DataTransfer | null): boolean {
  return imagesOf(transfer).length > 0;
}

// Étapes d'un diaporama, lues dans la page telle que l'éditeur l'a rendue : l'image de
// chaque étape, sa légende, et les éléments de son explication.
function readSlideshow(element: HTMLElement): ViewedSlideshow {
  const slides = Array.from(element.querySelectorAll<HTMLElement>('.slide-body')).map((body) => {
    const image = body.querySelector('figure img');
    return {
      src: image?.getAttribute('src') ?? '',
      alt: image?.getAttribute('alt') ?? '',
      caption: body.querySelector('figcaption')?.textContent.trim() ?? '',
      body: Array.from(body.children).filter(
        (child) => child.tagName !== 'FIGURE' && (child.textContent ?? '').trim().length > 0,
      ),
    };
  });
  return { title: element.querySelector('.slideshow-title')?.textContent.trim() ?? '', slides };
}
