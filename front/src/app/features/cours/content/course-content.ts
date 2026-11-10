import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { ContentNode } from './content-node';
import { createCourseExtensions } from './course-extensions';

// Affiche le contenu d'un cours avec le moteur de l'éditeur : le rendu est le même
// en lecture et en édition, et le contenu n'est jamais injecté comme du HTML.
@Component({
  selector: 'app-course-content',
  template: '',
  host: { class: 'course-content' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseContent {
  readonly content = input.required<ContentNode>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private editor?: Editor;

  constructor() {
    afterNextRender(() => {
      this.editor = new Editor({
        element: this.host.nativeElement,
        extensions: createCourseExtensions(),
        content: this.content(),
        editable: false,
      });
    });
    effect(() => {
      const content = this.content();
      this.editor?.commands.setContent(content);
    });
    inject(DestroyRef).onDestroy(() => this.editor?.destroy());
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
