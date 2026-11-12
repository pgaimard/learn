import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { CurrentUser, SessionService } from '../../core/auth/session.service';
import { ApiError } from '../../core/http/api-error';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let login: ReturnType<typeof vi.fn<SessionService['login']>>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setup(result: Observable<CurrentUser>): void {
    login = vi.fn<SessionService['login']>().mockReturnValue(result);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionService, useValue: { login } }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  }

  function fill(id: string, value: string): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  }

  function submit(): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  it('affiche puis masque le mot de passe à la demande', () => {
    setup(of({ username: 'pierre' }));
    const host = fixture.nativeElement as HTMLElement;
    const field = host.querySelector('#password') as HTMLInputElement;
    const reveal = host.querySelector('.reveal') as HTMLButtonElement;

    reveal.click();
    fixture.detectChanges();
    expect(field.type).toBe('text');
    expect(reveal.getAttribute('aria-label')).toBe('Masquer le mot de passe');

    reveal.click();
    fixture.detectChanges();
    expect(field.type).toBe('password');
  });

  it('connecte puis ouvre l’accueil', () => {
    setup(of({ username: 'pierre' }));
    fill('username', 'pierre');
    fill('password', 'secret');

    submit();

    expect(login).toHaveBeenCalledWith({ username: 'pierre', password: 'secret' });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('n’envoie rien tant que le formulaire est incomplet', () => {
    setup(of({ username: 'pierre' }));
    fill('username', 'pierre');

    submit();

    expect(login).not.toHaveBeenCalled();
    expect(text()).toContain('Le mot de passe est requis.');
  });

  it('affiche le message de l’API et vide le mot de passe après un refus', () => {
    setup(throwError(() => new ApiError(401, ['Identifiant ou mot de passe incorrect.'])));
    fill('username', 'pierre');
    fill('password', 'mauvais');

    submit();

    expect(text()).toContain('Identifiant ou mot de passe incorrect.');
    expect(navigate).not.toHaveBeenCalled();
    const password = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#password',
    );
    expect(password?.value).toBe('');
  });
});
