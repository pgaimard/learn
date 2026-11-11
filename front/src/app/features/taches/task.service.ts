import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface Task {
  id: number;
  title: string;
  ue: { code: string; title: string } | null;
  // Dates au format ISO 8601, ou null.
  dueAt: string | null;
  remindAt: string | null;
  done: boolean;
}

export interface TaskInput {
  title?: string;
  ueCode?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
  done?: boolean;
}

export interface TaskFilters {
  done?: boolean;
  dueFrom?: string;
  dueTo?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);

  // Augmente à chaque modification : la pastille de l'en-tête s'en sert pour se recharger.
  readonly revision = signal(0);

  list(filters: TaskFilters = {}): Observable<Task[]> {
    return this.http.get<Task[]>('/api/tasks', { params: { ...filters } });
  }

  create(input: TaskInput): Observable<Task> {
    return this.http.post<Task>('/api/tasks', input).pipe(tap(() => this.bump()));
  }

  update(id: number, changes: TaskInput): Observable<Task> {
    return this.http.patch<Task>(`/api/tasks/${id}`, changes).pipe(tap(() => this.bump()));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/tasks/${id}`).pipe(tap(() => this.bump()));
  }

  private bump(): void {
    this.revision.update((revision) => revision + 1);
  }
}
