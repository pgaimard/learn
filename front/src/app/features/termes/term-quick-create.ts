import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/http/api-error';
import { TermForm } from './term-form';
import { originFromUrl, TermOrigin } from './term-origin';
import { TERM_SCREENS } from './term-screens';
import { Term, TermInput, TermService } from './term.service';

// Création rapide d'un terme depuis n'importe quel écran, dans une boîte de dialogue.
@Component({
  selector: 'app-term-quick-create',
  imports: [RouterLink, TermForm],
  templateUrl: './term-quick-create.html',
  styleUrl: './term-quick-create.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermQuickCreate {
  private readonly termService = inject(TermService);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly screens = TERM_SCREENS;
  protected readonly isOpen = signal(false);
  protected readonly origin = signal<TermOrigin | null>(null);
  protected readonly created = signal<Term | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  protected open(): void {
    this.origin.set(originFromUrl(this.router.url));
    this.startOver();
    this.isOpen.set(true);
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected startOver(): void {
    this.created.set(null);
    this.errors.set([]);
  }

  protected create(input: TermInput): void {
    if (this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.termService.create(input).subscribe({
      next: (term) => {
        this.isSaving.set(false);
        this.created.set(term);
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.errors.set(error.messages);
      },
    });
  }
}
