import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { BackdropClick } from './backdrop-click';
import { ImageViewerService } from './image-viewer.service';

// Fenêtre qui montre une image en grand, sans rien autour ; elle se ferme par un clic sur
// l'image, par Échap ou par un clic en dehors.
@Component({
  selector: 'app-image-viewer',
  imports: [BackdropClick],
  template: `
    <dialog
      #dialog
      class="modal"
      [attr.aria-label]="viewer.image()?.caption || viewer.image()?.alt || 'Image'"
      appBackdropClick
      (backdropClick)="viewer.close()"
      (close)="viewer.close()"
    >
      @if (viewer.image(); as image) {
        <button type="button" class="image" title="Fermer" (click)="viewer.close()">
          <img [src]="image.src" [alt]="image.alt" />
        </button>
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
