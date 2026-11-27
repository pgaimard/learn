import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { GenerateAiAccessDto } from './ai-access.dto.js';
import { AiAccessService, AiAccessStatus } from './ai-access.service.js';

export interface GeneratedAiAccess extends AiAccessStatus {
  token: string;
}

// Gestion du jeton de l'IA depuis l'écran d'administration : sous la session, jamais
// par le jeton lui-même.
@Controller('ai-access')
export class AiAccessController {
  constructor(
    private readonly authService: AuthService,
    private readonly aiAccess: AiAccessService,
  ) {}

  @Get()
  async status(): Promise<{ access: AiAccessStatus | null }> {
    return { access: await this.aiAccess.status() };
  }

  // Le jeton ouvre les données à l'IA : le mot de passe est redemandé pour le créer.
  @UseGuards(ThrottlerGuard)
  @Post()
  async generate(
    @Body() body: GenerateAiAccessDto,
    @Req() request: Request,
  ): Promise<GeneratedAiAccess> {
    // La garde globale garantit la présence de userId sur une route non publique.
    await this.authService.confirmPassword(
      request.session.userId as number,
      body.password,
    );
    const token = await this.aiAccess.generate();
    return { token, createdAt: new Date(), lastUsedAt: null };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(): Promise<void> {
    return this.aiAccess.revoke();
  }
}
