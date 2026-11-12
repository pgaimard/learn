import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

// Nombre de cours, de termes et de fichiers rattachés à une UE.
export interface UeCounts {
  courses: number;
  terms: number;
  files: number;
}

export interface Ue {
  id: number;
  code: string;
  title: string;
  description: string;
  position: number;
  // Présents à la lecture d'une UE, pas dans la réponse à une création ou modification.
  counts?: UeCounts;
}

export interface UeInput {
  code: string;
  title: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class UeService {
  private readonly http = inject(HttpClient);

  list(): Observable<Ue[]> {
    return this.http.get<Ue[]>('/api/ues');
  }

  get(code: string): Observable<Ue> {
    return this.http.get<Ue>(`/api/ues/${encodeURIComponent(code)}`);
  }

  create(input: UeInput): Observable<Ue> {
    return this.http.post<Ue>('/api/ues', input);
  }

  update(code: string, input: UeInput): Observable<Ue> {
    return this.http.patch<Ue>(`/api/ues/${encodeURIComponent(code)}`, input);
  }

  // Enregistre l'ordre des UE : tous leurs codes, dans l'ordre voulu.
  reorder(codes: string[]): Observable<Ue[]> {
    return this.http.put<Ue[]>('/api/ues/order', { codes });
  }

  remove(code: string): Observable<void> {
    return this.http.delete<void>(`/api/ues/${encodeURIComponent(code)}`);
  }
}
