import { NestExpressApplication } from '@nestjs/platform-express';

export const API_PREFIX = 'api';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  // Un seul intermédiaire (le reverse proxy) : ses en-têtes X-Forwarded-* font foi
  // pour reconnaître HTTPS (cookie « Secure ») et l'adresse IP du client (limitation
  // des tentatives de connexion).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
}
