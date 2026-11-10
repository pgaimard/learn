import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { toApiError } from './api-error';

export const LOGIN_URL = '/connexion';

// Intercepteur unique : met les erreurs au format ApiError et traite la session expirée.
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      if (apiError.status === 401) {
        session.clear();
        if (!router.url.startsWith(LOGIN_URL)) {
          void router.navigateByUrl(LOGIN_URL);
        }
      }
      return throwError(() => apiError);
    }),
  );
};
