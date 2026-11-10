import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [UsersModule],
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
