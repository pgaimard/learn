import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ExcerptSegment {
  text: string;
  highlighted: boolean;
}

export interface SearchGroup<Item> {
  // Nombre de résultats trouvés ; seuls les plus pertinents sont renvoyés.
  total: number;
  items: Item[];
}

export interface CourseResult {
  id: number;
  title: string;
  ueCode: string;
  excerpt: ExcerptSegment[];
}

export interface TermResult {
  id: number;
  label: string;
  expandedForm: string | null;
  excerpt: ExcerptSegment[];
}

export interface SearchResults {
  courses: SearchGroup<CourseResult>;
  definitions: SearchGroup<TermResult>;
  acronyms: SearchGroup<TermResult>;
}

export const MIN_QUERY_LENGTH = 2;

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  search(query: string): Observable<SearchResults> {
    return this.http.get<SearchResults>('/api/search', { params: { q: query } });
  }
}
