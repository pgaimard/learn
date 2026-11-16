import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { TermDetail } from './term-detail';
import { Term, TermService } from './term.service';

@Component({
  selector: 'app-term-read-page',
  imports: [RouterLink, TermDetail],
  templateUrl: './term-read-page.html',
  styleUrl: './term-read-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermReadPage {
  // Paramètres de la route /ue/:code/termes/:id.
  readonly code = input.required<string>();
  readonly id = input.required<string>();

  private readonly termService = inject(TermService);
  private readonly title = inject(Title);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly term = signal<Term | null>(null);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  protected async remove(term: Term): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer le terme',
      `« ${term.label} » et sa définition seront supprimés définitivement.`,
    );
    if (!confirmed) {
      return;
    }
    this.termService.remove(term.id).subscribe({
      next: () =>
        void this.router.navigate(['/ue', term.ue.code], { queryParams: { onglet: 'termes' } }),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
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
