import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Tool } from './tool.service';

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

// Cours où une commande sert.
export interface CommandCourse {
  id: number;
  title: string;
  ueCode: string;
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
  // UE et cours où la commande sert.
  ueCodes: string[];
  courses: CommandCourse[];
  options: CommandOption[];
  examples: CommandExample[];
  alsoIn: CommandTwin[];
}

// Ce qu'une fiche de commande doit savoir de son outil.
export type CommandTool = Pick<Tool, 'id' | 'name' | 'modes' | 'variants'>;

// Commandes d'une UE ou d'un cours, rangées sous leur outil.
export interface CommandGroup {
  tool: CommandTool;
  commands: Command[];
}

export interface CommandInput {
  name: string;
  summary: string;
  syntax: string;
  modeId: number | null;
  variantIds: number[];
  notes: string;
  themes: string[];
  ueCodes: string[];
  courseIds: number[];
  options: Omit<CommandOption, 'id'>[];
  examples: Omit<CommandExample, 'id'>[];
}

@Injectable({ providedIn: 'root' })
export class CommandService {
  private readonly http = inject(HttpClient);

  list(toolId: number): Observable<Command[]> {
    return this.http.get<Command[]>(`/api/tools/${toolId}/commands`);
  }

  // Commandes étiquetées avec l'UE ou avec un de ses cours.
  listByUe(code: string): Observable<CommandGroup[]> {
    return this.http.get<CommandGroup[]>(`/api/ues/${code}/commands`);
  }

  listByCourse(courseId: number): Observable<CommandGroup[]> {
    return this.http.get<CommandGroup[]>(`/api/courses/${courseId}/commands`);
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
