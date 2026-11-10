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
import { createCourseExtensions } from './course-extensions';

// Affiche le contenu d'un cours avec le moteur de l'éditeur : le rendu est le même
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

  // Émis à chaque modification faite par l'utilisateur.
  readonly edited = output();

  // L'éditeur n'existe qu'après le premier rendu ; la barre d'outils s'y branche.
  readonly editor = signal<Editor | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.editor.set(
        new Editor({
          element: this.host.nativeElement,
          extensions: createCourseExtensions(),
          content: untracked(this.content),
          editable: untracked(this.editable),
          editorProps: { attributes: { 'aria-label': 'Contenu du cours' } },
          onUpdate: () => this.edited.emit(),
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

  getContent(): ContentNode {
    return (this.editor()?.getJSON() ?? this.content()) as ContentNode;
  }

  scrollToHeading(index: number): void {
    const headings = this.host.nativeElement.querySelectorAll<HTMLElement>('h2, h3, h4');
    const heading = headings.item(index) as HTMLElement | null;
    if (heading) {
      heading.tabIndex = -1;
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      heading.focus({ preventScroll: true });
    }
  }
}
