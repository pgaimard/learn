import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ImportedCommand {
  tool: string;
  name: string;
}

// Ce qu'un import de commandes créera, et ce qu'il trouve déjà en place.
export interface CommandImportPreview {
  newTools: string[];
  existingTools: string[];
  newCommands: ImportedCommand[];
  // Commandes déjà présentes dans leur outil : laissées telles quelles, ou remplacées
  // sur demande.
  duplicateCommands: ImportedCommand[];
}

// Import d'un fichier commandes.json seul, sans paquet de cours.
@Injectable({ providedIn: 'root' })
export class CommandImportService {
  private readonly http = inject(HttpClient);

  preview(content: string): Observable<CommandImportPreview> {
    return this.http.post<CommandImportPreview>('/api/command-imports/preview', { content });
  }

  import(content: string, replace: boolean): Observable<CommandImportPreview> {
    return this.http.post<CommandImportPreview>('/api/command-imports', { content, replace });
  }
}
