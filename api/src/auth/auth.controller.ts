import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SessionService,
} from './session.service.js';

export interface CurrentUserResponse {
  username: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() credentials: LoginDto,
    @Req() request: Request,
  ): Promise<CurrentUserResponse> {
    const user = await this.authService.validateCredentials(
      credentials.username,
      credentials.password,
    );
    await this.sessionService.regenerate(request);
    request.session.userId = user.id;
    return { username: user.username };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionService.destroy(request);
    response.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
  }

  @Get('me')
  async me(@Req() request: Request): Promise<CurrentUserResponse> {
    // La garde globale garantit la présence de userId sur une route non publique.
    const user = await this.authService.getCurrentUser(
      request.session.userId as number,
    );
    return { username: user.username };
  }
}
