import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  // Libellé du bouton qui confirme.
  confirmLabel: string;
  // Action sans retour (suppression, perte de modifications) : le bouton est en rouge.
  isDestructive: boolean;
}

export interface PromptRequest {
  title: string;
  // Libellé du champ de saisie.
  label: string;
  initialValue: string;
  // Précision affichée sous le champ.
  hint?: string;
}

export type DialogRequest =
  ({ kind: 'confirm' } & ConfirmRequest) | ({ kind: 'prompt' } & PromptRequest);

// Confirmations et saisies dans une modale de l'application, à la place des boîtes du
// navigateur. La modale elle-même est affichée par DialogHost, à la racine.
@Injectable({ providedIn: 'root' })
export class DialogService {
  // Demande en attente de réponse ; lue par DialogHost.
  readonly request = signal<DialogRequest | null>(null);

  // Clôt la demande en cours : avec la réponse donnée, ou comme une annulation.
  private settle: ((answer: boolean | string | null) => void) | null = null;

  // Résout à true si l'utilisateur confirme, à false s'il annule ou ferme la modale.
  confirm(request: ConfirmRequest): Promise<boolean> {
    return this.ask({ kind: 'confirm', ...request }).then((answer) => answer === true);
  }

  confirmDeletion(title: string, message: string): Promise<boolean> {
    return this.confirm({ title, message, confirmLabel: 'Supprimer', isDestructive: true });
  }

  // Résout au texte validé (peut-être vide), ou à null si l'utilisateur annule.
  prompt(request: PromptRequest): Promise<string | null> {
    return this.ask({ kind: 'prompt', ...request }).then((answer) =>
      typeof answer === 'string' ? answer : null,
    );
  }

  // Appelés par DialogHost ; sans effet s'il n'y a plus de demande en attente.
  answer(answer: boolean | string): void {
    this.close(answer);
  }

  cancel(): void {
    this.close(null);
  }

  private ask(request: DialogRequest): Promise<boolean | string | null> {
    // Une seule modale à la fois : une demande restée ouverte est annulée.
    this.cancel();
    this.request.set(request);
    return new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  private close(answer: boolean | string | null): void {
    const settle = this.settle;
    this.settle = null;
    this.request.set(null);
    settle?.(answer);
  }
}
