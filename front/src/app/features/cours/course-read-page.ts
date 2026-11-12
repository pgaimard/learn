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
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http/api-error';
import { buildOutline } from './content/build-outline';
import { hasSheetContent, sheetHeadingIndexes } from './revision/revision-sheet';
import { CourseContent } from './content/course-content';
import { Course, CourseService } from './course.service';

@Component({
  selector: 'app-course-read-page',
  imports: [CourseContent, RouterLink],
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
  protected readonly isSheetEmpty = computed(() => {
    const course = this.course();
    return this.isSheet() && !!course && !hasSheetContent(course.content);
  });

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  protected goTo(index: number): void {
    this.contentView()?.scrollToHeading(index);
  }

  private load(id: number): void {
    this.course.set(null);
    this.courseService.get(id).subscribe({
      next: (course) => {
        this.course.set(course);
        this.title.setTitle(course.title);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
