import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  All,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { AiAccessGuard } from './ai-access.guard.js';
import { McpToolsService } from './mcp-tools.service.js';

const CALLS_PER_MINUTE = 120;

// Point d'entrée MCP, appelé par le connecteur de Claude. Exception explicite à la garde
// de session : l'accès se fait par le jeton de l'IA, et lui seul.
@Public()
@UseGuards(ThrottlerGuard, AiAccessGuard)
@Throttle({ default: { limit: CALLS_PER_MINUTE, ttl: 60_000 } })
@Controller('mcp')
export class McpController {
  constructor(private readonly tools: McpToolsService) {}

  // Sans état : chaque requête est traitée seule et reçoit sa réponse en JSON.
  @Post()
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const server = this.tools.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  // Ni flux ouvert par le serveur ni session à fermer : seules les requêtes POST servent.
  @All()
  refuse(@Res() response: Response): void {
    response
      .status(HttpStatus.METHOD_NOT_ALLOWED)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Méthode non autorisée.' },
        id: null,
      });
  }
}
