import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http/api-error';
import { CourseContent } from '../cours/content/course-content';
import { TERM_SCREENS } from './term-screens';
import { Term, TermService } from './term.service';

@Component({
  selector: 'app-term-read-page',
  imports: [CourseContent, RouterLink],
  templateUrl: './term-read-page.html',
  styleUrl: './term-read-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermReadPage {
  // Paramètre de la route /dictionnaire/:id ou /glossaire/:id.
  readonly id = input.required<string>();

  private readonly termService = inject(TermService);
  private readonly title = inject(Title);

  protected readonly term = signal<Term | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly screen = computed(() => TERM_SCREENS[this.term()?.type ?? 'definition']);

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  private load(id: number): void {
    this.term.set(null);
    this.termService.get(id).subscribe({
      next: (term) => {
        this.term.set(term);
        this.title.setTitle(term.label);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
