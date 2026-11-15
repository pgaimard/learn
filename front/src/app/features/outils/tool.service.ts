import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContentNode } from '../cours/content/content-node';

// Résumé d'un outil pour la liste.
export interface ToolSummary {
  id: number;
  name: string;
  summary: string;
  ueCodes: string[];
}

// Mode d'un terminal : son invite et la façon d'y entrer.
export interface ToolMode {
  id: number;
  name: string;
  prompt: string;
  entry: string;
}

// Déclinaison d'un outil (bash et zsh pour « Shell Unix »).
export interface ToolVariant {
  id: number;
  name: string;
}

export interface Tool {
  id: number;
  name: string;
  summary: string;
  content: ContentNode;
  modes: ToolMode[];
  variants: ToolVariant[];
  ues: { code: string; title: string }[];
}

// Un mode ou une déclinaison déjà enregistré garde son numéro ; un nouveau n'en a pas.
export type ToolModeInput = Omit<ToolMode, 'id'> & { id?: number };
export type ToolVariantInput = Omit<ToolVariant, 'id'> & { id?: number };

export interface ToolInput {
  name?: string;
  summary?: string;
  content?: ContentNode;
  ueCodes?: string[];
  modes?: ToolModeInput[];
  variants?: ToolVariantInput[];
}

@Injectable({ providedIn: 'root' })
export class ToolService {
  private readonly http = inject(HttpClient);

  list(): Observable<ToolSummary[]> {
    return this.http.get<ToolSummary[]>('/api/tools');
  }

  get(id: number): Observable<Tool> {
    return this.http.get<Tool>(`/api/tools/${id}`);
  }

  create(input: ToolInput): Observable<Tool> {
    return this.http.post<Tool>('/api/tools', input);
  }

  update(id: number, changes: ToolInput): Observable<Tool> {
    return this.http.patch<Tool>(`/api/tools/${id}`, changes);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/tools/${id}`);
  }
}
