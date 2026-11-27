import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { AiAccessPanel } from './ai-access-panel';
import { AiAccess, AiAccessService } from './ai-access.service';

const ACCESS: AiAccess = { createdAt: '2026-11-20T09:30:00Z', lastUsedAt: null };
const TOKEN = 'learn_jeton-tout-neuf';

describe('AiAccessPanel', () => {
  let fixture: ComponentFixture<AiAccessPanel>;
  const service = {
    status: vi.fn<AiAccessService['status']>(),
    generate: vi.fn<AiAccessService['generate']>(),
    revoke: vi.fn<AiAccessService['revoke']>(),
  };
  const confirm = vi.fn<DialogService['confirm']>();

  function setup(access: AiAccess | null): void {
    service.status.mockReset().mockReturnValue(of(access));
    service.generate.mockReset().mockReturnValue(of({ ...ACCESS, token: TOKEN }));
    service.revoke.mockReset().mockReturnValue(of(undefined));
    confirm.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AiAccessService, useValue: service },
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    fixture = TestBed.createComponent(AiAccessPanel);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll('button')).find((candidate) =>
      candidate.textContent.includes(label),
    );
  }

  function submit(password: string): void {
    const field = element().querySelector('#ai-access-password') as HTMLInputElement;
    field.value = password;
    field.dispatchEvent(new Event('input'));
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('donne l’adresse du serveur et dit qu’aucun jeton n’est en service', () => {
    setup(null);

    expect(element().querySelector('.copyable code')?.textContent).toBe(
      `${location.origin}/api/mcp`,
    );
    expect(element().textContent).toContain('Aucun jeton : l’IA n’a pas accès aux données.');
    expect(button('Créer un jeton')).toBeDefined();
    expect(button('Révoquer')).toBeUndefined();
  });

  it('crée un jeton sur confirmation du mot de passe et l’affiche une fois, prêt pour l’en-tête', () => {
    setup(null);

    submit('secret');

    expect(service.generate).toHaveBeenCalledWith('secret');
    expect(element().querySelector('.fresh code')?.textContent).toBe(`Bearer ${TOKEN}`);
    expect(element().textContent).toContain('elle ne sera plus affichée');
    expect(element().textContent).toContain('Pas encore utilisé.');
    expect((element().querySelector('#ai-access-password') as HTMLInputElement).value).toBe('');
  });

  it('ne crée rien sans mot de passe, et affiche le refus de l’API', () => {
    setup(null);
    service.generate.mockReturnValue(
      throwError(() => new ApiError(403, ['Mot de passe incorrect.'])),
    );

    submit('');
    expect(service.generate).not.toHaveBeenCalled();

    submit('mauvais');
    expect(element().textContent).toContain('Mot de passe incorrect.');
    expect(element().querySelector('.fresh')).toBeNull();
  });

  it('prévient qu’un nouveau jeton révoque celui en service, et montre sa dernière utilisation', () => {
    setup({ ...ACCESS, lastUsedAt: '2026-11-21T10:00:00Z' });

    expect(element().textContent).toContain('Dernière utilisation le 21/11/2026');
    expect(element().textContent).toContain('Créer un nouveau jeton révoque le précédent.');
    expect(button('Créer un nouveau jeton')).toBeDefined();
  });

  it('révoque l’accès après confirmation seulement', async () => {
    setup(ACCESS);
    confirm.mockResolvedValueOnce(false);

    button('Révoquer')?.click();
    await fixture.whenStable();
    expect(service.revoke).not.toHaveBeenCalled();

    button('Révoquer')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.revoke).toHaveBeenCalledTimes(1);
    expect(element().textContent).toContain('Aucun jeton');
  });

  it('copie l’adresse dans le presse-papiers et le signale', async () => {
    setup(null);
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    button('Copier')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(`${location.origin}/api/mcp`);
    expect(button('Copié')).toBeDefined();
    vi.unstubAllGlobals();
  });
});
