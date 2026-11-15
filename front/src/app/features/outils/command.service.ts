import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CommandOption {
  id: number;
  // L'option telle qu'on la tape : « -c <nombre> ».
  text: string;
  description: string;
  // Déclinaisons de l'outil où l'option existe ; aucune : elle vaut pour toutes.
  variantIds: number[];
}

export interface CommandExample {
  id: number;
  line: string;
  explanation: string;
  // Ce que le terminal répond ; vide quand l'exemple n'en montre rien.
  output: string;
}

// Commande de même nom dans un autre outil.
export interface CommandTwin {
  commandId: number;
  toolId: number;
  toolName: string;
}

// Commande apprise d'un outil ; son mode et ses déclinaisons sont ceux de l'outil.
export interface Command {
  id: number;
  name: string;
  summary: string;
  syntax: string;
  modeId: number | null;
  variantIds: number[];
  notes: string;
  themes: string[];
  options: CommandOption[];
  examples: CommandExample[];
  alsoIn: CommandTwin[];
}

export interface CommandInput {
  name: string;
  summary: string;
  syntax: string;
  modeId: number | null;
  variantIds: number[];
  notes: string;
  themes: string[];
  options: Omit<CommandOption, 'id'>[];
  examples: Omit<CommandExample, 'id'>[];
}

@Injectable({ providedIn: 'root' })
export class CommandService {
  private readonly http = inject(HttpClient);

  list(toolId: number): Observable<Command[]> {
    return this.http.get<Command[]>(`/api/tools/${toolId}/commands`);
  }

  create(toolId: number, input: CommandInput): Observable<Command> {
    return this.http.post<Command>(`/api/tools/${toolId}/commands`, input);
  }

  update(toolId: number, id: number, changes: CommandInput): Observable<Command> {
    return this.http.patch<Command>(`/api/tools/${toolId}/commands/${id}`, changes);
  }

  remove(toolId: number, id: number): Observable<void> {
    return this.http.delete<void>(`/api/tools/${toolId}/commands/${id}`);
  }
}
