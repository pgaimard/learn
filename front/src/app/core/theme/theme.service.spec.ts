import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  function systemPrefers(dark: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: dark, addEventListener: vi.fn() })),
    );
  }

  beforeEach(() => {
    localStorage.clear();
    delete root.dataset['theme'];
  });

  afterEach(() => vi.unstubAllGlobals());

  it('suit le système tant que rien n’est choisi', () => {
    systemPrefers(true);

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(root.dataset['theme']).toBeUndefined();
  });

  it('bascule, applique le thème et le garde', () => {
    systemPrefers(false);
    const service = TestBed.inject(ThemeService);

    service.toggle();

    expect(service.theme()).toBe('dark');
    expect(root.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('reprend le choix gardé, même contraire au système', () => {
    systemPrefers(true);
    localStorage.setItem('theme', 'light');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
    expect(root.dataset['theme']).toBe('light');
  });

  it('ignore une valeur gardée inconnue', () => {
    systemPrefers(false);
    localStorage.setItem('theme', 'rose');

    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });
});
