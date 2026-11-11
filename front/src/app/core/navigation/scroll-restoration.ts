import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { NavigationStart, Router, Scroll } from '@angular/router';

const RETRY_INTERVAL_MS = 50;
const MAX_WAIT_MS = 3000;
// Gestes par lesquels l'utilisateur reprend la main sur le défilement.
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown', 'mousedown'];

// Au retour sur une page (bouton Précédent), replace l'affichage là où il était.
// Les pages chargent leur contenu après la navigation : la position est donc appliquée
// dès que la page est redevenue assez haute, et non à la fin de la navigation.
@Injectable({ providedIn: 'root' })
export class ScrollRestoration {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private timer: ReturnType<typeof setInterval> | null = null;
  private path = '';
  private readonly cancel = (): void => this.stop();

  start(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.stop();
      } else if (event instanceof Scroll) {
        this.onNavigated(event);
      }
    });
  }

  private onNavigated(event: Scroll): void {
    const previousPath = this.path;
    this.path = this.router.url.split(/[?#]/)[0];
    if (event.position) {
      this.restore(event.position);
    } else if (this.path !== previousPath) {
      // Nouvelle page : on la lit depuis le haut. Un simple changement de paramètre
      // (onglet, recherche affinée) ne déplace rien.
      this.window()?.scrollTo(0, 0);
    }
  }

  private restore([left, top]: [number, number]): void {
    const deadline = Date.now() + MAX_WAIT_MS;
    const attempt = (): void => {
      const reachable =
        this.document.documentElement.scrollHeight - (this.window()?.innerHeight ?? 0);
      if (reachable >= top || Date.now() >= deadline) {
        this.window()?.scrollTo(left, Math.min(top, Math.max(reachable, 0)));
        this.stop();
      }
    };
    this.timer = setInterval(attempt, RETRY_INTERVAL_MS);
    for (const name of USER_SCROLL_EVENTS) {
      this.document.addEventListener(name, this.cancel, { passive: true });
    }
    attempt();
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const name of USER_SCROLL_EVENTS) {
      this.document.removeEventListener(name, this.cancel);
    }
  }

  private window(): Window | null {
    return this.document.defaultView;
  }
}
