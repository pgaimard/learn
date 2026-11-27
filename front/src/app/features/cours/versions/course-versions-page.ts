import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DialogService } from '../../../core/dialog/dialog.service';
import { ApiError } from '../../../core/http/api-error';
import { Icon } from '../../../core/ui/icon';
import { Course, CourseService } from '../course.service';
import { CourseVersion, CourseVersionService, VersionOrigin } from './course-version.service';

const ORIGIN_LABELS: Record<VersionOrigin, string> = {
  ai: 'Avant une modification par l’IA',
  package: 'Avant le remplacement par un paquet',
  restore: 'Avant une restauration',
};

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

@Component({
  selector: 'app-course-versions-page',
  imports: [DatePipe, Icon, RouterLink],
  templateUrl: './course-versions-page.html',
  styleUrl: './course-versions-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseVersionsPage {
  // Paramètres de la route /ue/:code/cours/:id/versions.
  readonly code = input.required<string>();
  readonly id = input.required<string>();

  private readonly courseService = inject(CourseService);
  private readonly versionService = inject(CourseVersionService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  protected readonly course = signal<Course | null>(null);
  protected readonly versions = signal<CourseVersion[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly isRestoring = signal(false);
  protected readonly originLabels = ORIGIN_LABELS;

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  protected async restore(version: CourseVersion): Promise<void> {
    const course = this.course();
    if (!course || this.isRestoring() || !(await this.confirm(version))) {
      return;
    }
    this.isRestoring.set(true);
    this.errors.set([]);
    this.versionService.restore(course.id, version.id, course.revision).subscribe({
      next: () => void this.router.navigate(['/ue', this.code(), 'cours', course.id]),
      error: (error: ApiError) => {
        this.isRestoring.set(false);
        this.errors.set(error.messages);
      },
    });
  }

  private confirm(version: CourseVersion): Promise<boolean> {
    const date = DATE_TIME.format(new Date(version.createdAt));
    return this.dialog.confirm({
      title: 'Restaurer cette version',
      message: `Le cours, sa fiche et ses exercices reviendront à leur état du ${date}. L’état actuel sera gardé comme version précédente : la restauration peut être annulée.`,
      confirmLabel: 'Restaurer',
      isDestructive: false,
    });
  }

  private load(id: number): void {
    forkJoin({
      course: this.courseService.get(id),
      versions: this.versionService.list(id),
    }).subscribe({
      next: ({ course, versions }) => {
        this.course.set(course);
        this.versions.set(versions);
        this.title.setTitle(`Versions précédentes – ${course.title}`);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}
