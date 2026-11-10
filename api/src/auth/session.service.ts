import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import type { CookieOptions, Request, RequestHandler } from 'express';
import session from 'express-session';
import { Environment } from '../config/environment.js';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export const SESSION_COOKIE_NAME = '__Host-session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

const PgStore = connectPgSimple(session);

@Injectable()
export class SessionService implements OnModuleDestroy {
  readonly middleware: RequestHandler;
  private readonly store: InstanceType<typeof PgStore>;

  constructor(config: ConfigService<Environment, true>) {
    this.store = new PgStore({
      tableName: 'sessions',
      conObject: {
        host: config.get('DATABASE_HOST', { infer: true }),
        port: config.get('DATABASE_PORT', { infer: true }),
        database: config.get('DATABASE_NAME', { infer: true }),
        user: config.get('DATABASE_USER', { infer: true }),
        password: config.get('DATABASE_PASSWORD', { infer: true }),
        max: 2,
      },
    });
    this.middleware = session({
      name: SESSION_COOKIE_NAME,
      secret: config.get('SESSION_SECRET', { infer: true }),
      store: this.store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE_MS },
    });
  }

  onModuleDestroy(): void {
    this.store.close();
  }

  // Nouvel identifiant de session à la connexion, contre la fixation de session.
  regenerate(request: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      request.session.regenerate((error: unknown) => {
        if (error) {
          reject(toError(error));
        } else {
          resolve();
        }
      });
    });
  }

  destroy(request: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      request.session.destroy((error: unknown) => {
        if (error) {
          reject(toError(error));
        } else {
          resolve();
        }
      });
    });
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
