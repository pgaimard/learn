import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { BackdropClick } from './backdrop-click';
import { Icon } from './icon';
import { ImageViewerService } from './image-viewer.service';

// Fenêtre qui montre une image en grand ; elle se ferme par son bouton, par Échap ou
// par un clic en dehors.
@Component({
  selector: 'app-image-viewer',
  imports: [BackdropClick, Icon],
  template: `
    <dialog
      #dialog
      class="modal"
      aria-labelledby="image-viewer-title"
      appBackdropClick
      (backdropClick)="viewer.close()"
      (close)="viewer.close()"
    >
      @if (viewer.image(); as image) {
        <div class="modal-header">
          <h2 id="image-viewer-title">{{ image.caption || image.alt || 'Image' }}</h2>
          <button
            type="button"
            class="button button-icon button-ghost"
            aria-label="Fermer la fenêtre"
            (click)="viewer.close()"
          >
            <app-icon name="close" [size]="15" />
          </button>
        </div>
        <div class="modal-body">
          <img [src]="image.src" [alt]="image.alt" />
        </div>
      }
    </dialog>
  `,
  styleUrl: './image-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageViewer {
  protected readonly viewer = inject(ImageViewerService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.viewer.image() === null) {
        dialog.close();
      } else if (!dialog.open) {
        dialog.showModal();
      }
    });
  }
}
