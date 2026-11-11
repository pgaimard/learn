import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { DialogService } from './dialog.service';

// Modale de confirmation de l'application, pilotée par DialogService.
@Component({
  selector: 'app-dialog-host',
  templateUrl: './dialog-host.html',
  styleUrl: './dialog-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogHost {
  private readonly dialogService = inject(DialogService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancel');

  protected readonly request = this.dialogService.request;

  constructor() {
    // Après le rendu : les boutons de la demande existent quand la modale s'ouvre.
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.request() === null) {
        dialog.close();
      } else if (!dialog.open) {
        dialog.showModal();
        // Le focus va sur « Annuler » : valider par réflexe avec Entrée ne confirme
        // donc jamais une suppression.
        this.cancelButton()?.nativeElement.focus();
      }
    });
  }

  protected answer(confirmed: boolean): void {
    this.dialogService.answer(confirmed);
  }
}
