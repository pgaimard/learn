import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AiAccessService } from './ai-access.service.js';

const BEARER = /^Bearer (\S+)$/;

// Garde du serveur MCP : la requête doit porter le jeton en service, dans l'en-tête
// « Authorization: Bearer … ». La session par cookie n'y donne pas accès.
@Injectable()
export class AiAccessGuard implements CanActivate {
  constructor(private readonly aiAccess: AiAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const token = BEARER.exec(
      http.getRequest<Request>().get('authorization') ?? '',
    )?.[1];
    if (token === undefined || !(await this.aiAccess.verify(token))) {
      http.getResponse<Response>().set('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedException('Jeton d’accès absent ou invalide.');
    }
    return true;
  }
}
