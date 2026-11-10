import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  messages: string[];
}

const ERROR_LABELS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Requête invalide',
  [HttpStatus.UNAUTHORIZED]: 'Authentification requise',
  [HttpStatus.FORBIDDEN]: 'Accès refusé',
  [HttpStatus.NOT_FOUND]: 'Ressource introuvable',
  [HttpStatus.CONFLICT]: 'Conflit',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Contenu trop volumineux',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Trop de requêtes',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Erreur interne',
};

const INTERNAL_ERROR_MESSAGE = 'Une erreur interne est survenue.';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toErrorResponse(exception);
    response.status(body.statusCode).json(body);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        error: ERROR_LABELS[statusCode] ?? 'Erreur',
        messages: extractMessages(exception),
      };
    }
    this.logger.error(exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Erreur interne',
      messages: [INTERNAL_ERROR_MESSAGE],
    };
  }
}

function extractMessages(exception: HttpException): string[] {
  const response = exception.getResponse();
  if (typeof response === 'object' && 'message' in response) {
    const { message } = response;
    if (Array.isArray(message)) {
      return message.map(String);
    }
    if (typeof message === 'string') {
      return [message];
    }
  }
  return [exception.message];
}
