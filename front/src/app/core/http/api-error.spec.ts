import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('reprend le statut et les messages de l’API', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { statusCode: 400, error: 'Requête invalide', messages: ['Le titre est requis.'] },
    });

    const apiError = toApiError(error);

    expect(apiError.status).toBe(400);
    expect(apiError.messages).toEqual(['Le titre est requis.']);
  });

  it('signale un serveur injoignable', () => {
    const apiError = toApiError(new HttpErrorResponse({ status: 0 }));

    expect(apiError.messages).toEqual(['Le serveur est injoignable. Vérifiez votre connexion.']);
  });

  it('donne un message générique quand la réponse n’a pas le format attendu', () => {
    const apiError = toApiError(new HttpErrorResponse({ status: 502, error: '<html>' }));

    expect(apiError.status).toBe(502);
    expect(apiError.messages).toEqual(['Une erreur inattendue est survenue.']);
  });

  it('ignore les messages qui ne sont pas du texte', () => {
    const error = new HttpErrorResponse({ status: 400, error: { messages: ['Valide', 42, null] } });

    expect(toApiError(error).messages).toEqual(['Valide']);
  });
});
