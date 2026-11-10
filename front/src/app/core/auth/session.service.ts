import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

export interface CurrentUser {
  username: string;
}

export interface Credentials {
  username: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly currentUser = signal<CurrentUser | null>(null);
  private restoration?: Observable<boolean>;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  // Interroge l'API une seule fois, même si plusieurs gardes le demandent en même temps :
  // le cookie de session est illisible depuis le navigateur.
  restore(): Observable<boolean> {
    this.restoration ??= this.http.get<CurrentUser>('/api/auth/me').pipe(
      tap((user) => this.currentUser.set(user)),
      map(() => true),
      catchError(() => of(false)),
      shareReplay(1),
    );
    return this.restoration.pipe(map(() => this.isAuthenticated()));
  }

  login(credentials: Credentials): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>('/api/auth/login', credentials)
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null).pipe(tap(() => this.clear()));
  }

  clear(): void {
    this.currentUser.set(null);
  }
}
