import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { BackdropClick } from './backdrop-click';
import { Icon } from './icon';

let nextId = 0;

// Fenêtre modale : elle s'ouvre dès qu'elle est affichée (dans un @if) et signale sa
// fermeture, par son bouton, par Échap ou par un clic en dehors. Le contenu est projeté ; un élément marqué
// modalFooter va dans la bande d'actions.
@Component({
  selector: 'app-modal',
  imports: [BackdropClick, Icon],
  template: `
    <dialog
      #dialog
      class="modal"
      [class.modal-wide]="wide()"
      [attr.aria-labelledby]="titleId"
      appBackdropClick
      (backdropClick)="closed.emit()"
      (close)="closed.emit()"
    >
      <div class="modal-header">
        <h2 [id]="titleId">{{ heading() }}</h2>
        <button
          type="button"
          class="button button-icon button-ghost"
          aria-label="Fermer la fenêtre"
          (click)="closed.emit()"
        >
          <app-icon name="close" [size]="15" />
        </button>
      </div>
      <div class="modal-body"><ng-content /></div>
      <ng-content select="[modalFooter]" />
    </dialog>
  `,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly heading = input.required<string>();
  readonly wide = input(false);

  readonly closed = output();

  protected readonly titleId = `modal-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      // showModal manque à l'environnement de test : la fenêtre y est simplement ouverte.
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      // Le curseur va dans le premier champ plutôt que sur le bouton de fermeture.
      dialog.querySelector<HTMLElement>('.modal-body input, .modal-body textarea')?.focus();
    });
  }
}
