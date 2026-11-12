import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ContentNode } from '../cours/content/content-node';
import { UploadedImage } from '../cours/course.service';

export type TermType = 'definition' | 'acronym';

export interface TermSummary {
  id: number;
  type: TermType;
  label: string;
  expandedForm: string | null;
  // Début de la définition en texte brut.
  excerpt: string;
}

export interface Term {
  id: number;
  type: TermType;
  label: string;
  expandedForm: string | null;
  content: ContentNode;
  ue: { code: string; title: string } | null;
  course: { id: number; title: string } | null;
}

export interface TermInput {
  type?: TermType;
  label?: string;
  expandedForm?: string | null;
  content?: ContentNode;
  ueCode?: string | null;
  courseId?: number | null;
}

export interface TermFilters {
  type?: TermType;
  ue?: string;
  // Identifiant du cours dont les termes sont issus.
  course?: number;
}

@Injectable({ providedIn: 'root' })
export class TermService {
  private readonly http = inject(HttpClient);

  // Augmente à chaque création : les listes affichées s'en servent pour se recharger.
  readonly revision = signal(0);

  list(filters: TermFilters = {}): Observable<TermSummary[]> {
    return this.http.get<TermSummary[]>('/api/terms', { params: { ...filters } });
  }

  get(id: number): Observable<Term> {
    return this.http.get<Term>(`/api/terms/${id}`);
  }

  create(input: TermInput): Observable<Term> {
    return this.http
      .post<Term>('/api/terms', input)
      .pipe(tap(() => this.revision.update((revision) => revision + 1)));
  }

  update(id: number, changes: TermInput): Observable<Term> {
    return this.http.patch<Term>(`/api/terms/${id}`, changes);
  }

  uploadImage(termId: number, file: File): Observable<UploadedImage> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadedImage>(`/api/terms/${termId}/images`, form);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/terms/${id}`);
  }
}
