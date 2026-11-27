import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { AuthorizeExportDto } from './export.dto.js';
import { ExportsService } from './exports.service.js';

declare module 'express-session' {
  interface SessionData {
    // Instant jusqu'auquel la session peut télécharger un export, une seule fois.
    exportAllowedUntil: number;
  }
}

const AUTHORIZATION_WINDOW_MS = 60 * 1000;

@Controller('exports')
export class ExportsController {
  constructor(
    private readonly authService: AuthService,
    private readonly exportsService: ExportsService,
  ) {}

  // L'export donne toute la donnée : le mot de passe est redemandé, la session ne suffit
  // pas. Le téléchargement qui suit se fait par un lien, sans mot de passe dans l'adresse.
  @UseGuards(ThrottlerGuard)
  @Post('authorization')
  @HttpCode(HttpStatus.NO_CONTENT)
  async authorize(
    @Body() body: AuthorizeExportDto,
    @Req() request: Request,
  ): Promise<void> {
    // La garde globale garantit la présence de userId sur une route non publique.
    await this.authService.confirmPassword(
      request.session.userId as number,
      body.password,
    );
    request.session.exportAllowedUntil = Date.now() + AUTHORIZATION_WINDOW_MS;
  }

  @Get()
  async download(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const allowedUntil = request.session.exportAllowedUntil ?? 0;
    delete request.session.exportAllowedUntil;
    if (Date.now() > allowedUntil) {
      throw new ForbiddenException(
        'Confirmez votre mot de passe pour exporter les données.',
      );
    }
    const archive = await this.exportsService.create();
    response.set({
      'Content-Type': 'application/x-tar',
      'Content-Disposition': `attachment; filename="${archive.name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(archive.stream);
  }
}
