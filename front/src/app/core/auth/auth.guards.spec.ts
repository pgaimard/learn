import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { anonymousGuard, authenticatedGuard } from './auth.guards';
import { SessionService } from './session.service';

function runGuard(guard: CanActivateFn, isAuthenticated: boolean): Promise<boolean | string> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SessionService, useValue: { restore: () => of(isAuthenticated) } },
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Observable<boolean | UrlTree>;
  return firstValueFrom(result).then((value) =>
    value instanceof UrlTree ? value.toString() : value,
  );
}

describe('authenticatedGuard', () => {
  it('laisse passer avec une session', async () => {
    expect(await runGuard(authenticatedGuard, true)).toBe(true);
  });

  it('renvoie à la connexion sans session', async () => {
    expect(await runGuard(authenticatedGuard, false)).toBe('/connexion');
  });
});

describe('anonymousGuard', () => {
  it('laisse passer sans session', async () => {
    expect(await runGuard(anonymousGuard, false)).toBe(true);
  });

  it('renvoie à l’accueil avec une session', async () => {
    expect(await runGuard(anonymousGuard, true)).toBe('/');
  });
});
