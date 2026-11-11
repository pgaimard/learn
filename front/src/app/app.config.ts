import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { ScrollRestoration } from './core/navigation/scroll-restoration';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withInMemoryScrolling : le routeur mémorise les positions de défilement ;
    // ScrollRestoration les applique une fois le contenu de la page chargé.
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling()),
    provideAppInitializer(() => inject(ScrollRestoration).start()),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
  ],
};
