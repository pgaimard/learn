import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { createOrderSaver } from '../../core/sortable/order-saver';
import {
  moveItem,
  SortableHandle,
  SortableItem,
  SortableList,
  SortChange,
} from '../../core/sortable/sortable';
import { UeForm } from './ue-form';
import { Ue, UeInput, UeService } from './ue.service';

@Component({
  selector: 'app-ue-list-page',
  imports: [RouterLink, SortableHandle, SortableItem, SortableList, UeForm],
  templateUrl: './ue-list-page.html',
  styleUrl: './ue-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeListPage implements OnInit {
  private readonly ueService = inject(UeService);
  private readonly dialog = inject(DialogService);

  protected readonly ues = signal<Ue[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly pageErrors = signal<string[]>([]);
  // UE en cours de modification, « new » pour une création, null si aucun formulaire ouvert.
  protected readonly editing = signal<Ue | 'new' | null>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly isSaving = signal(false);

  private readonly saveOrder = createOrderSaver<string[]>(
    (codes) => this.ueService.reorder(codes),
    () => this.pageErrors.set([]),
    (error) => this.load(error.messages),
  );

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

  // L'ordre change tout de suite à l'écran, puis il est enregistré ; en cas de refus,
  // la liste est rechargée telle qu'elle est en base.
  protected reorder(change: SortChange): void {
    const ordered = moveItem(this.ues(), change);
    if (ordered.every((ue, index) => ue === this.ues()[index])) {
      return;
    }
    this.ues.set(ordered);
    this.saveOrder(ordered.map((ue) => ue.code));
  }

  protected async remove(ue: Ue): Promise<void> {
    const confirmed = await this.dialog.confirmDeletion(
      'Supprimer l’UE',
      `L’UE ${ue.code} sera supprimée. Elle doit être vide.`,
    );
    if (!confirmed) {
      return;
    }
    this.ueService.remove(ue.code).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.pageErrors.set(error.messages),
    });
  }

  // messages : erreur à laisser affichée une fois la liste rechargée.
  private load(messages: string[] = []): void {
    this.ueService.list().subscribe({
      next: (ues) => {
        this.ues.set(ues);
        this.pageErrors.set(messages);
        this.isLoading.set(false);
      },
      error: (error: ApiError) => {
        this.pageErrors.set(error.messages);
        this.isLoading.set(false);
      },
    });
  }
}
