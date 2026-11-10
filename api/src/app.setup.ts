import { NestExpressApplication } from '@nestjs/platform-express';

export const API_PREFIX = 'api';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  // Un seul intermédiaire (le reverse proxy) : son en-tête X-Forwarded-Proto fait foi
  // pour reconnaître HTTPS et poser le cookie de session « Secure ».
  app.set('trust proxy', 1);
}
