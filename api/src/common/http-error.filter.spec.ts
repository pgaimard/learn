import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ErrorResponse, HttpErrorFilter } from './http-error.filter.js';

interface CapturedResponse {
  statusCode?: number;
  body?: ErrorResponse;
}

function createHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(statusCode: number) {
      captured.statusCode = statusCode;
      return response;
    },
    json(body: ErrorResponse) {
      captured.body = body;
      return response;
    },
  };
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function filterException(exception: unknown): CapturedResponse {
  const captured: CapturedResponse = {};
  const filter = new HttpErrorFilter();
  vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  filter.catch(exception, createHost(captured));
  return captured;
}

describe('HttpErrorFilter', () => {
  it('conserve la liste des messages de validation', () => {
    const captured = filterException(
      new BadRequestException(['Le titre est requis', 'Le code est requis']),
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toEqual({
      statusCode: 400,
      error: 'Requête invalide',
      messages: ['Le titre est requis', 'Le code est requis'],
    });
  });

  it('place un message unique dans une liste', () => {
    const captured = filterException(
      new ForbiddenException('Action interdite'),
    );

    expect(captured.body).toEqual({
      statusCode: 403,
      error: 'Accès refusé',
      messages: ['Action interdite'],
    });
  });

  it('masque le détail d’une erreur inattendue', () => {
    const captured = filterException(
      new Error('connexion à la base perdue : secret'),
    );

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toEqual({
      statusCode: 500,
      error: 'Erreur interne',
      messages: ['Une erreur interne est survenue.'],
    });
  });
});
