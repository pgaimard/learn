import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { BackdropClick } from '../ui/backdrop-click';
import { Icon } from '../ui/icon';
import { DialogService } from './dialog.service';

// Modale de confirmation ou de saisie de l'application, pilotée par DialogService.
@Component({
  selector: 'app-dialog-host',
  imports: [BackdropClick, Icon],
  templateUrl: './dialog-host.html',
  styleUrl: './dialog-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogHost {
  private readonly dialogService = inject(DialogService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  // Élément qui reçoit le focus à l'ouverture : « Annuler » ou le champ de saisie.
  private readonly initialFocus = viewChild<ElementRef<HTMLElement>>('initialFocus');

  protected readonly request = this.dialogService.request;

  constructor() {
    // Après le rendu : le contenu de la demande existe quand la modale s'ouvre.
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.request() === null) {
        dialog.close();
      } else if (!dialog.open) {
        dialog.showModal();
        // Confirmation : le focus va sur « Annuler », valider par réflexe avec Entrée
        // ne confirme donc jamais une suppression. Saisie : il va dans le champ.
        const target = this.initialFocus()?.nativeElement;
        target?.focus();
        if (target instanceof HTMLInputElement) {
          target.select();
        }
      }
    });
  }

  protected confirm(): void {
    this.dialogService.answer(true);
  }

  protected submit(event: Event, value: string): void {
    // Formulaire natif : l'envoi par défaut rechargerait la page.
    event.preventDefault();
    this.dialogService.answer(value);
  }

  // Clic en dehors : une saisie s'abandonne ainsi, une confirmation attend sa réponse.
  protected dismiss(): void {
    if (this.request()?.kind === 'prompt') {
      this.cancel();
    }
  }

  protected cancel(): void {
    this.dialogService.cancel();
  }
}
