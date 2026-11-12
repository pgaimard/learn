import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import { Icon } from '../../core/ui/icon';
import { shortcut } from '../../core/ui/platform';
import { MIN_QUERY_LENGTH } from './search.service';

export const SEARCH_PATH = '/recherche';
const TYPING_PAUSE_MS = 300;

// Barre de recherche de l'en-tête : elle mène à la page de résultats, à la validation
// ou après une courte pause de frappe.
@Component({
  selector: 'app-search-box',
  imports: [Icon, ReactiveFormsModule],
  templateUrl: './search-box.html',
  styleUrl: './search-box.css',
  host: {
    '(document:keydown.control.k)': 'focusFromKeyboard($event)',
    '(document:keydown.meta.k)': 'focusFromKeyboard($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBox {
  private readonly router = inject(Router);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly query = new FormControl('', { nonNullable: true });
  // Le raccourci affiché est celui du clavier de l'appareil ; les deux fonctionnent.
  protected readonly shortcut = shortcut('K');

  constructor() {
    this.query.valueChanges
      .pipe(
        debounceTime(TYPING_PAUSE_MS),
        map((value) => value.trim()),
        filter((value) => value.length >= MIN_QUERY_LENGTH),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((value) => this.open(value));
    // Une page de résultats ouverte par son adresse remplit la barre.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.showCurrentQuery());
  }

  // Formulaire natif, sans groupe de contrôles : l'envoi par défaut rechargerait la page.
  protected submit(event: Event): void {
    event.preventDefault();
    const value = this.query.value.trim();
    if (value.length >= MIN_QUERY_LENGTH) {
      this.open(value);
    }
  }

  protected focusFromKeyboard(event: Event): void {
    event.preventDefault();
    this.field().nativeElement.focus();
    this.field().nativeElement.select();
  }

  private open(value: string): void {
    void this.router.navigate([SEARCH_PATH], {
      queryParams: { q: value },
      // Affiner une recherche ne doit pas empiler une page d'historique par frappe.
      replaceUrl: this.isOnSearchPage(),
    });
  }

  private showCurrentQuery(): void {
    const isTyping = document.activeElement === this.field().nativeElement;
    if (this.isOnSearchPage() && !isTyping) {
      const shown: unknown = this.router.parseUrl(this.router.url).queryParams['q'];
      this.query.setValue(typeof shown === 'string' ? shown : '', { emitEvent: false });
    }
  }

  private isOnSearchPage(): boolean {
    return this.router.url.split('?')[0] === SEARCH_PATH;
  }
}
