import { Injectable, signal } from '@angular/core';

export interface ViewedSlide {
  src: string;
  alt: string;
  // Titre de l'étape : la légende de son image ; vide quand elle n'en a pas.
  caption: string;
  // Explication de l'étape : des éléments déjà mis en forme, copiés du cours.
  body: Node[];
}

export interface ViewedSlideshow {
  title: string;
  slides: ViewedSlide[];
}

// Diaporama affiché dans sa fenêtre ; null quand elle est fermée.
@Injectable({ providedIn: 'root' })
export class SlideshowViewerService {
  readonly slideshow = signal<ViewedSlideshow | null>(null);

  open(slideshow: ViewedSlideshow): void {
    if (slideshow.slides.length > 0) {
      this.slideshow.set(slideshow);
    }
  }

  close(): void {
    this.slideshow.set(null);
  }
}
