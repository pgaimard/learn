import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Ue {
  id: number;
  code: string;
  title: string;
  description: string;
  position: number;
}

export interface UeInput {
  code: string;
  title: string;
  description: string;
  position?: number;
}

@Injectable({ providedIn: 'root' })
export class UeService {
  private readonly http = inject(HttpClient);

  list(): Observable<Ue[]> {
    return this.http.get<Ue[]>('/api/ues');
  }

  create(input: UeInput): Observable<Ue> {
    return this.http.post<Ue>('/api/ues', input);
  }

  update(code: string, input: UeInput): Observable<Ue> {
    return this.http.patch<Ue>(`/api/ues/${encodeURIComponent(code)}`, input);
  }

  remove(code: string): Observable<void> {
    return this.http.delete<void>(`/api/ues/${encodeURIComponent(code)}`);
  }
}
