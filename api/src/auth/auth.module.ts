import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

const LOGIN_ATTEMPTS_LIMIT = 5;
const LOGIN_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;

@Module({
  imports: [
    UsersModule,
    // Compteur en mémoire, par adresse IP : suffisant pour une seule instance d'API.
    ThrottlerModule.forRoot({
      throttlers: [
        { limit: LOGIN_ATTEMPTS_LIMIT, ttl: LOGIN_ATTEMPTS_WINDOW_MS },
      ],
      errorMessage:
        'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule implements NestModule {
  constructor(private readonly sessionService: SessionService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(this.sessionService.middleware).forRoutes('{*path}');
  }
}
