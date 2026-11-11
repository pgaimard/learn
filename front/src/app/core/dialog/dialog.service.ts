import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  // Libellé du bouton qui confirme.
  confirmLabel: string;
  // Action sans retour (suppression, perte de modifications) : le bouton est en rouge.
  isDestructive: boolean;
}

// Demande de confirmation dans une modale de l'application, à la place de la boîte du
// navigateur. La modale elle-même est affichée par DialogHost, à la racine.
@Injectable({ providedIn: 'root' })
export class DialogService {
  // Demande en attente de réponse ; lue par DialogHost.
  readonly request = signal<ConfirmRequest | null>(null);

  private settle: ((confirmed: boolean) => void) | null = null;

  // Résout à true si l'utilisateur confirme, à false s'il annule ou ferme la modale.
  confirm(request: ConfirmRequest): Promise<boolean> {
    // Une seule modale à la fois : une demande restée ouverte est annulée.
    this.answer(false);
    this.request.set(request);
    return new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  confirmDeletion(title: string, message: string): Promise<boolean> {
    return this.confirm({ title, message, confirmLabel: 'Supprimer', isDestructive: true });
  }

  // Appelé par DialogHost ; sans effet s'il n'y a plus de demande en attente.
  answer(confirmed: boolean): void {
    const settle = this.settle;
    this.settle = null;
    this.request.set(null);
    settle?.(confirmed);
  }
}
