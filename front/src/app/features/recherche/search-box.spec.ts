import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SearchBox } from './search-box';

@Component({ template: '' })
class Blank {}

describe('SearchBox', () => {
  let fixture: ComponentFixture<SearchBox>;
  let router: Router;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'recherche', component: Blank },
          { path: '**', component: Blank },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SearchBox);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  function field(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  }

  function type(value: string): void {
    field().value = value;
    field().dispatchEvent(new Event('input'));
  }

  async function settle(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  it('ouvre les résultats après une pause de frappe', async () => {
    type('mém');
    await settle(200);
    expect(router.url).toBe('/');

    type('mémoire');
    await settle(300);

    expect(router.url).toBe('/recherche?q=m%C3%A9moire');
  });

  it('attend au moins deux caractères', async () => {
    type(' m ');
    await settle(300);
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    await settle(0);

    expect(router.url).toBe('/');
  });

  it('ouvre les résultats dès la validation', async () => {
    type('pagination');
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    await settle(0);

    expect(router.url).toBe('/recherche?q=pagination');
  });

  it('affine la recherche sans empiler l’historique', async () => {
    await router.navigateByUrl('/recherche?q=pagination');
    const navigate = vi.spyOn(router, 'navigate');

    type('pagination mémoire');
    await settle(300);

    expect(navigate).toHaveBeenCalledWith(['/recherche'], {
      queryParams: { q: 'pagination mémoire' },
      replaceUrl: true,
    });
  });

  it('reprend la recherche d’une page de résultats ouverte par son adresse', async () => {
    await router.navigateByUrl('/recherche?q=processus');

    expect(field().value).toBe('processus');
  });

  it('prend le focus avec Ctrl+K', () => {
    document.body.append(fixture.nativeElement as HTMLElement);
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });

    document.dispatchEvent(event);

    expect(document.activeElement).toBe(field());
    expect(event.defaultPrevented).toBe(true);
  });
});
