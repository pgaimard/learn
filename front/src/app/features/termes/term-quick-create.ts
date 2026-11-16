import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { TermForm } from './term-form';
import { Term, TermInput, TermService } from './term.service';

// Création rapide d'un terme de l'UE, dans une boîte de dialogue.
@Component({
  selector: 'app-term-quick-create',
  imports: [Icon, RouterLink, TermForm],
  templateUrl: './term-quick-create.html',
  styleUrl: './term-quick-create.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermQuickCreate {
  readonly ueCode = input.required<string>();

  private readonly termService = inject(TermService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly isOpen = signal(false);
  protected readonly created = signal<Term | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  protected open(): void {
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
