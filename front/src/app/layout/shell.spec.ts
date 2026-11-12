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

  function element(selector: string): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLButtonElement;
  }

  // Le bouton de déconnexion est dans le menu du compte, ouvert par la pastille.
  function logoutButton(): HTMLButtonElement {
    if (!element('.account-item')) {
      element('.avatar').click();
      fixture.detectChanges();
    }
    return element('.account-item');
  }

  it('affiche les initiales du compte, puis son identifiant dans le menu', () => {
    setup(of(undefined));

    expect(element('.avatar').textContent.trim()).toBe('pi');
    expect(element('.avatar').getAttribute('aria-label')).toBe('Compte pierre');

    element('.avatar').click();
    fixture.detectChanges();

    expect(element('.account-name').textContent).toBe('pierre');
  });

  it('ferme le menu du compte sur Échap ou sur un clic ailleurs', () => {
    setup(of(undefined));

    logoutButton();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element('.account-item')).toBeNull();

    logoutButton();
    document.body.click();
    fixture.detectChanges();
    expect(element('.account-item')).toBeNull();
  });

  it('bascule le thème et renomme le bouton', () => {
    setup(of(undefined));
    const toggle = element('button[aria-label^="Passer au thème"]');
    const before = toggle.getAttribute('aria-label');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-label')).not.toBe(before);
    expect(document.documentElement.dataset['theme']).toBeDefined();
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
