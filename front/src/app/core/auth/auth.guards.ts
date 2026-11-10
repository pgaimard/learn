import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { LOGIN_URL } from '../http/api-error.interceptor';
import { SessionService } from './session.service';

// Toute page exige une session ; sans elle, retour à la connexion.
export const authenticatedGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(SessionService)
    .restore()
    .pipe(map((isAuthenticated) => isAuthenticated || router.parseUrl(LOGIN_URL)));
};

// La page de connexion n'a pas de sens une fois connecté.
export const anonymousGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(SessionService)
    .restore()
    .pipe(map((isAuthenticated) => !isAuthenticated || router.parseUrl('/')));
};
