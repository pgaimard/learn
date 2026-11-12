import { Injectable, signal } from '@angular/core';

export interface ViewedImage {
  src: string;
  alt: string;
  // Légende de la figure ; vide quand elle n'en a pas.
  caption: string;
}

// Image affichée en grand dans une fenêtre ; null quand la fenêtre est fermée.
@Injectable({ providedIn: 'root' })
export class ImageViewerService {
  readonly image = signal<ViewedImage | null>(null);

  open(image: ViewedImage): void {
    this.image.set(image);
  }

  close(): void {
    this.image.set(null);
  }
}
