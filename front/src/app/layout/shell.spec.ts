import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { SessionService } from '../core/auth/session.service';
import { ApiError } from '../core/http/api-error';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setup(logoutResult: Observable<void>): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: { user: signal({ username: 'pierre' }), logout: () => logoutResult },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  }

  function logoutButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'button.logout',
    ) as HTMLButtonElement;
  }

  it('affiche l’identifiant du compte connecté', () => {
    setup(of(undefined));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('pierre');
  });

  it('renvoie à la connexion après la déconnexion', () => {
    setup(of(undefined));

    logoutButton().click();

    expect(navigate).toHaveBeenCalledWith('/connexion');
  });

  it('reste sur la page et réactive le bouton si la déconnexion échoue', () => {
    setup(throwError(() => new ApiError(0, ['Le serveur est injoignable.'])));

    logoutButton().click();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(logoutButton().disabled).toBe(false);
  });
});
