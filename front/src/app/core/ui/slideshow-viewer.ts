import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BackdropClick } from './backdrop-click';
import { Icon } from './icon';
import { SlideshowViewerService } from './slideshow-viewer.service';

// Fenêtre d'un diaporama : une étape à la fois, son image, son titre et son explication.
// On avance et on recule par les boutons ou par les flèches du clavier.
@Component({
  selector: 'app-slideshow-viewer',
  imports: [BackdropClick, Icon],
  templateUrl: './slideshow-viewer.html',
  styleUrl: './slideshow-viewer.css',
  host: {
    '(document:keydown.arrowleft)': 'stepFromKeyboard($event, -1)',
    '(document:keydown.arrowright)': 'stepFromKeyboard($event, 1)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideshowViewer {
  protected readonly viewer = inject(SlideshowViewerService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  protected readonly index = signal(0);
  protected readonly slides = computed(() => this.viewer.slideshow()?.slides ?? []);
  protected readonly current = computed(() => this.slides().at(this.index()) ?? null);
  protected readonly isFirst = computed(() => this.index() === 0);
  protected readonly isLast = computed(() => this.index() >= this.slides().length - 1);

  constructor() {
    // Un diaporama s'ouvre toujours à sa première étape.
    effect(() => {
      this.viewer.slideshow();
      this.index.set(0);
    });
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.viewer.slideshow() === null) {
        dialog.close();
      } else if (!dialog.open) {
        dialog.showModal();
      }
    });
    // L'explication est faite d'éléments du cours : ils sont copiés tels quels, jamais
    // réécrits comme du HTML.
    afterRenderEffect(() => {
      const nodes = this.current()?.body ?? [];
      this.body()?.nativeElement.replaceChildren(...nodes.map((node) => node.cloneNode(true)));
    });
  }

  protected step(direction: -1 | 1): void {
    const target = this.index() + direction;
    if (target >= 0 && target < this.slides().length) {
      this.index.set(target);
    }
  }

  // Les flèches ne servent au diaporama que lorsqu'il est ouvert.
  protected stepFromKeyboard(event: Event, direction: -1 | 1): void {
    if (this.viewer.slideshow() === null) {
      return;
    }
    event.preventDefault();
    this.step(direction);
  }
}
