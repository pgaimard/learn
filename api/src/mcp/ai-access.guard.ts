import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AiAccessService } from './ai-access.service.js';

// En-tête qui porte le jeton. Le connecteur personnalisé de Claude réserve
// « Authorization » à OAuth et n'accepte que des noms d'une liste fixe, dont celui-ci.
export const AI_TOKEN_HEADER = 'X-API-Key';

// Garde du serveur MCP : la requête doit porter le jeton en service dans l'en-tête
// « X-API-Key ». La session par cookie n'y donne pas accès.
@Injectable()
export class AiAccessGuard implements CanActivate {
  constructor(private readonly aiAccess: AiAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = context
      .switchToHttp()
      .getRequest<Request>()
      .get(AI_TOKEN_HEADER);
    if (token === undefined || !(await this.aiAccess.verify(token))) {
      throw new UnauthorizedException('Jeton d’accès absent ou invalide.');
    }
    return true;
  }
}
