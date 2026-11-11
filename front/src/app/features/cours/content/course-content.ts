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
import { ContentNode } from './content-node';
import { revealPosition } from '../editor/sections/section-folding';
import { createCourseExtensions } from './course-extensions';

// Affiche un contenu (cours ou définition d'un terme) avec le moteur de l'éditeur : le rendu est le même
// en lecture et en édition, et le contenu n'est jamais injecté comme du HTML.
@Component({
  selector: 'app-course-content',
  template: '',
  host: { class: 'course-content', '[class.is-editable]': 'editable()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseContent {
  readonly content = input.required<ContentNode>();
  readonly editable = input(false);
  // Nom accessible de la zone de contenu.
  readonly label = input('Contenu du cours');

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
  // Barre du bloc de code où se trouve le curseur : le bloc et son coin haut droit.
  readonly codeBlockBar = signal<{ pos: number; top: number; left: number } | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.editor.set(
        new Editor({
          element: this.host.nativeElement,
          extensions: createCourseExtensions({
            blockHandle: {
              onOpenMenu: ({ pos, top }) =>
                this.blockMenu.set({ pos, top: top + this.host.nativeElement.offsetTop }),
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
                this.codeBlockBar.set(target && place ? { pos: target.pos, ...place } : null);
              },
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
          onUpdate: () => {
            this.blockMenu.set(null);
            this.tableMenu.set(null);
            this.edited.emit();
          },
        }),
      );
    });
    effect(() => {
      const content = this.content();
      // emitUpdate à false : charger un contenu n'est pas une modification de l'utilisateur.
      untracked(this.editor)?.commands.setContent(content, { emitUpdate: false });
    });
    effect(() => {
      const editable = this.editable();
      untracked(this.editor)?.setEditable(editable, false);
    });
    inject(DestroyRef).onDestroy(() => this.editor()?.destroy());
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
