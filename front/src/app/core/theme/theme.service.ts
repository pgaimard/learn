import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// Thème clair ou sombre : celui du système tant que rien n'a été choisi, puis le
// choix fait dans le menu du compte, gardé dans le navigateur.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = this.document.defaultView?.matchMedia?.(
    '(prefers-color-scheme: dark)',
  );

  private readonly chosen = signal<Theme | null>(this.readChoice());
  // Thème choisi ; null quand on suit celui du système.
  readonly choice = this.chosen.asReadonly();
  private readonly system = signal<Theme>(this.systemDark?.matches ? 'dark' : 'light');

  readonly theme = computed<Theme>(() => this.chosen() ?? this.system());

  constructor() {
    this.systemDark?.addEventListener('change', (event) =>
      this.system.set(event.matches ? 'dark' : 'light'),
    );
    this.apply(this.chosen());
  }

  // Fixe le thème, ou revient à celui du système (null).
  choose(theme: Theme | null): void {
    this.chosen.set(theme);
    this.apply(theme);
    this.store(theme);
  }

  // Sans choix, l'attribut est absent : la feuille de style suit le système.
  private apply(theme: Theme | null): void {
    const root = this.document.documentElement;
    if (theme) {
      root.dataset['theme'] = theme;
    } else {
      delete root.dataset['theme'];
    }
  }

  // Le stockage peut être refusé (navigation privée) : le choix vaut alors pour la page.
  private readChoice(): Theme | null {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }

  private store(theme: Theme | null): void {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (theme) {
        storage?.setItem(STORAGE_KEY, theme);
      } else {
        storage?.removeItem(STORAGE_KEY);
      }
    } catch {
      // Rien à faire : le thème reste appliqué pour la page en cours.
    }
  }
}
