import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/http/api-error';
import { UeForm } from './ue-form';
import { Ue, UeInput, UeService } from './ue.service';

@Component({
  selector: 'app-ue-list-page',
  imports: [RouterLink, UeForm],
  templateUrl: './ue-list-page.html',
  styleUrl: './ue-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeListPage implements OnInit {
  private readonly ueService = inject(UeService);

  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  // UE en cours de modification, « new » pour une création, null si aucun formulaire ouvert.
  protected readonly editing = signal<Ue | 'new' | null>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected open(target: Ue | 'new'): void {
    this.formErrors.set([]);
    this.editing.set(target);
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected save(input: UeInput): void {
    const target = this.editing();
    if (target === null || this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    const request =
      target === 'new' ? this.ueService.create(input) : this.ueService.update(target.code, input);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.close();
        this.load();
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.formErrors.set(error.messages);
      },
    });
  }

  protected remove(ue: Ue): void {
    if (!confirm(`Supprimer l’UE ${ue.code} ?`)) {
      return;
    }
    this.ueService.remove(ue.code).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  private load(): void {
    this.ueService.list().subscribe({
      next: (ues) => {
        this.ues.set(ues);
        this.pageErrors.set([]);
        this.isLoading.set(false);
      },
      error: (error: ApiError) => {
        this.pageErrors.set(error.messages);
        this.isLoading.set(false);
      },
    });
  }
}
