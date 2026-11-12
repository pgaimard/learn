import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, map, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { DisplayedGroup, toDisplayedGroups } from './search-groups';
import { MIN_QUERY_LENGTH, SearchService } from './search.service';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; query: string; groups: DisplayedGroup[] };

@Component({
  selector: 'app-search-page',
  imports: [Icon, RouterLink],
  templateUrl: './search-page.html',
  styleUrl: './search-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {
  // Paramètre de requête ?q=… ; il est tenu à jour par la barre de recherche.
  readonly q = input<string>();

  private readonly searchService = inject(SearchService);
  private readonly title = inject(Title);
  private readonly location = inject(Location);

  protected readonly state = signal<State>({ kind: 'idle' });
  protected readonly errors = signal<string[]>([]);
  protected readonly total = computed(() => {
    const state = this.state();
    return state.kind === 'done' ? state.groups.reduce((sum, group) => sum + group.total, 0) : 0;
  });

  constructor() {
    toObservable(this.q)
      .pipe(
        map((query) => (query ?? '').trim()),
        tap((query) => this.title.setTitle(query ? `Recherche – ${query}` : 'Recherche')),
        // switchMap : seule la réponse à la dernière saisie est affichée.
        switchMap((query) => this.load(query)),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  // Retour à la page quittée pour chercher ; l'affichage y reprend à la même hauteur.
  protected goBack(): void {
    this.location.back();
  }

  private load(query: string) {
    this.errors.set([]);
    if (query.length < MIN_QUERY_LENGTH) {
      return of<State>({ kind: 'idle' });
    }
    this.state.set({ kind: 'loading' });
    return this.searchService.search(query).pipe(
      map((results): State => ({ kind: 'done', query, groups: toDisplayedGroups(results) })),
      catchError((error: ApiError) => {
        this.errors.set(error.messages);
        this.state.set({ kind: 'idle' });
        return EMPTY;
      }),
    );
  }
}
