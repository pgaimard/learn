import { DOCUMENT } from '@angular/common';
import { effect, inject, Signal } from '@angular/core';
import { CourseService } from './course.service';

// L'API tient le cours pour « en édition » deux minutes après la dernière déclaration.
export const EDITING_RENEWAL_MS = 30_000;

// Déclare le cours « en édition » tant que la page d'édition est ouverte : pendant ce temps,
// l'API refuse qu'il soit modifié autrement (IA, remplacement par un paquet, restauration),
// ce que l'éditeur écraserait à son prochain enregistrement. À appeler depuis le
// constructeur de la page.
export function holdEditingLock(courseId: Signal<number>): void {
  const courseService = inject(CourseService);
  const view = inject(DOCUMENT).defaultView;

  effect((onCleanup) => {
    const id = courseId();
    // Un échec n'empêche pas d'éditer : la révision du cours protège encore l'enregistrement.
    const declare = (): unknown => courseService.startEditing(id).subscribe({ error: () => null });
    const release = (): void => courseService.releaseEditing(id);
    declare();
    const timer = setInterval(declare, EDITING_RENEWAL_MS);
    // Onglet fermé ou page rechargée : la page n'est pas détruite proprement.
    view?.addEventListener('pagehide', release);
    onCleanup(() => {
      clearInterval(timer);
      view?.removeEventListener('pagehide', release);
      release();
    });
  });
}
