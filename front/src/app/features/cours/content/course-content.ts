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
import { ContentNode } from './content-node';
import { revealPosition } from '../editor/sections/section-folding';
import { SlashMenuState } from '../editor/slash/slash-menu-state';
import { setSheetView } from '../revision/revision-sheet-view';
import { CodeBlockTarget } from '../editor/selection/selection-watcher';
import { createCourseExtensions } from './course-extensions';

// Affiche un contenu (cours ou définition d'un terme) avec le moteur de l'éditeur : le rendu est le même
// en lecture et en édition, et le contenu n'est jamais injecté comme du HTML.
@Component({
  selector: 'app-course-content',
  template: '',
  host: {
    class: 'course-content',
    '[class.is-editable]': 'editable()',
    '(click)': 'zoom($event)',
    '(keydown.enter)': 'zoom($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseContent {
  readonly content = input.required<ContentNode>();
  readonly editable = input(false);
  // Nom accessible de la zone de contenu.
  readonly label = input('Contenu du cours');
  // Réduit l'affichage à la fiche de révision du cours.
  readonly sheet = input(false);
  // Rang du bloc de premier niveau à amener au milieu de l'écran à l'ouverture ; en
  // édition, le curseur s'y place.
  readonly startBlock = input<number | null>(null);

  // Émis à chaque modification faite par l'utilisateur.
  readonly edited = output();
  // Émis pour chaque image collée ou déposée ; l'envoi est fait par la page.
  readonly imageReceived = output<File>();

  // L'éditeur n'existe qu'après le premier rendu ; la barre d'outils s'y branche.
  readonly editor = signal<Editor | null>(null);
  // Bloc dont le menu est ouvert : sa position dans le document et la hauteur où
  // afficher le menu, en pixels depuis le haut du conteneur de ce composant.
  readonly blockMenu = signal<{ pos: number; top: number } | null>(null);
  // Menu de tableau ouvert par un clic droit : où l'afficher, dans le même repère.
  readonly tableMenu = signal<{ top: number; left: number } | null>(null);
  // Barre de mise en forme de la sélection : où l'afficher, dans le même repère.
  readonly selectionBar = signal<{ top: number; left: number } | null>(null);
  // Barre du bloc de code où se trouve le curseur : le bloc et son coin haut gauche.
  readonly codeBlockBar = signal<CodeBlockTarget | null>(null);
  // Menu « / » d'insertion de bloc.
  readonly slash = new SlashMenuState(
    () => this.editor(),
    () => this.pickImages(),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly imageViewer = inject(ImageViewerService);

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
    effect(() => {
      const content = this.content();
      // emitUpdate à false : charger un contenu n'est pas une modification de l'utilisateur.
      untracked(this.editor)?.commands.setContent(content, { emitUpdate: false });
    });
    effect(() => {
      const isSheet = this.sheet();
      const view = this.editor()?.view;
      if (view) {
        setSheetView(view, isSheet);
      }
    });
    effect(() => {
      const editable = this.editable();
      untracked(this.editor)?.setEditable(editable, false);
    });
    inject(DestroyRef).onDestroy(() => this.editor()?.destroy());
  }

  // En lecture, un clic (ou Entrée) sur l'image d'une figure l'ouvre en grand.
  protected zoom(event: Event): void {
    const image = event.target;
    if (this.editable() || !(image instanceof HTMLImageElement)) {
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
    const field = document.createElement('input');
    field.type = 'file';
    field.accept = 'image/png,image/jpeg,image/svg+xml';
    field.multiple = true;
    field.addEventListener('change', () => {
      for (const file of Array.from(field.files ?? [])) {
        this.imageReceived.emit(file);
      }
    });
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
