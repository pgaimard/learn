import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { AdminPage } from './admin-page';
import { ExportService } from './export.service';

describe('AdminPage', () => {
  let fixture: ComponentFixture<AdminPage>;
  let authorize: ReturnType<typeof vi.fn<ExportService['authorize']>>;
  let download: ReturnType<typeof vi.fn<ExportService['download']>>;

  function setup(result: Observable<void>): void {
    authorize = vi.fn<ExportService['authorize']>().mockReturnValue(result);
    download = vi.fn<ExportService['download']>();
    TestBed.configureTestingModule({
      providers: [{ provide: ExportService, useValue: { authorize, download } }],
    });
    fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
  }

  function password(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '#export-password',
    ) as HTMLInputElement;
  }

  function submit(value: string): void {
    password().value = value;
    password().dispatchEvent(new Event('input'));
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  it('n’envoie rien sans mot de passe', () => {
    setup(of(undefined));

    submit('');

    expect(authorize).not.toHaveBeenCalled();
    expect(text()).toContain('Le mot de passe est requis.');
  });

  it('confirme le mot de passe, lance le téléchargement et vide le champ', () => {
    setup(of(undefined));

    submit('secret');

    expect(authorize).toHaveBeenCalledWith('secret');
    expect(download).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Le téléchargement a commencé.');
    expect(password().value).toBe('');
  });

  it('affiche le refus de l’API et ne télécharge rien', () => {
    setup(throwError(() => new ApiError(403, ['Mot de passe incorrect.'])));

    submit('mauvais');

    expect(download).not.toHaveBeenCalled();
    expect(text()).toContain('Mot de passe incorrect.');
    expect(text()).not.toContain('Le téléchargement a commencé.');
  });
});
