import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const EXPORT_URL = '/api/exports';

// Export de toute la donnée de l'application : la base et les fichiers envoyés.
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  // Confirme le mot de passe : l'API accepte ensuite un téléchargement, un seul, dans la minute.
  authorize(password: string): Observable<void> {
    return this.http.post<void>(`${EXPORT_URL}/authorization`, { password });
  }

  // Le navigateur télécharge l'archive lui-même, par un lien : elle peut être volumineuse
  // et n'a pas à passer par la mémoire de la page.
  download(): void {
    const link = this.document.createElement('a');
    link.href = EXPORT_URL;
    link.download = '';
    link.click();
  }
}
