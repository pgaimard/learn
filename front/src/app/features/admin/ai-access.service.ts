import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

// Jeton de l'IA en service : quand il a été créé, et quand il a servi pour la dernière fois.
export interface AiAccess {
  createdAt: string;
  lastUsedAt: string | null;
}

// À sa création seulement, le jeton lui-même : l'API ne le redonnera plus.
export interface GeneratedAiAccess extends AiAccess {
  token: string;
}

const URL = '/api/ai-access';

// Accès de Claude aux données par le serveur MCP de l'application.
@Injectable({ providedIn: 'root' })
export class AiAccessService {
  private readonly http = inject(HttpClient);

  // null tant qu'aucun jeton n'est en service.
  status(): Observable<AiAccess | null> {
    return this.http.get<{ access: AiAccess | null }>(URL).pipe(map((body) => body.access));
  }

  // Crée le jeton, après confirmation du mot de passe ; le précédent cesse de fonctionner.
  generate(password: string): Observable<GeneratedAiAccess> {
    return this.http.post<GeneratedAiAccess>(URL, { password });
  }

  revoke(): Observable<void> {
    return this.http.delete<void>(URL);
  }
}
