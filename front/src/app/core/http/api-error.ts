import { HttpErrorResponse } from '@angular/common/http';

const UNREACHABLE_MESSAGE = 'Le serveur est injoignable. Vérifiez votre connexion.';
const UNEXPECTED_MESSAGE = 'Une erreur inattendue est survenue.';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join(' '));
  }
}

function readMessages(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('messages' in body)) {
    return [];
  }
  const { messages } = body;
  return Array.isArray(messages) ? messages.filter((message) => typeof message === 'string') : [];
}

// Ramène toute erreur HTTP au format unique de l'API : un statut et des messages affichables.
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(0, [UNEXPECTED_MESSAGE]);
  }
  if (error.status === 0) {
    return new ApiError(0, [UNREACHABLE_MESSAGE]);
  }
  const messages = readMessages(error.error);
  return new ApiError(error.status, messages.length > 0 ? messages : [UNEXPECTED_MESSAGE]);
}
