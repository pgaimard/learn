import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Scroll, withInMemoryScrolling } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { ScrollRestoration } from './scroll-restoration';

@Component({ template: '' })
class Blank {}

describe('ScrollRestoration', () => {
  let router: Router;
  let scrollTo: ReturnType<typeof vi.spyOn>;
  let pageHeight: number;

  // Rejoue la fin d'une navigation, avec la position mémorisée par le routeur s'il y en a une.
  function arrive(url: string, position: [number, number] | null): void {
    vi.spyOn(router, 'url', 'get').mockReturnValue(url);
    (router.events as Subject<unknown>).next(
      new Scroll(new NavigationEnd(1, url, url), position, null),
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Blank }], withInMemoryScrolling())],
    });
    router = TestBed.inject(Router);
    pageHeight = 0;
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(() => pageHeight);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    TestBed.inject(ScrollRestoration).start();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('attend que la page soit assez haute pour replacer l’affichage', () => {
    arrive('/ue/UTC502/cours/7', [0, 1800]);
    vi.advanceTimersByTime(200);
    expect(scrollTo).not.toHaveBeenCalled();

    pageHeight = 5000;
    vi.advanceTimersByTime(50);

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 1800);
  });

  it('replace tout de suite une page déjà affichée', () => {
    pageHeight = 5000;

    arrive('/ue/UTC502/cours/7', [0, 1800]);

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 1800);
  });

  it('va au plus bas possible si la page reste trop courte', () => {
    pageHeight = 1000;
    arrive('/ue/UTC502/cours/7', [0, 1800]);

    vi.advanceTimersByTime(3000);

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 400);
  });

  it('abandonne dès que l’utilisateur fait défiler la page lui-même', () => {
    arrive('/ue/UTC502/cours/7', [0, 1800]);

    document.dispatchEvent(new Event('wheel'));
    pageHeight = 5000;
    vi.advanceTimersByTime(3000);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('abandonne quand une autre navigation commence', async () => {
    arrive('/ue/UTC502/cours/7', [0, 1800]);

    await router.navigateByUrl('/glossaire');
    scrollTo.mockClear();
    pageHeight = 5000;
    vi.advanceTimersByTime(3000);

    expect(scrollTo).not.toHaveBeenCalledWith(0, 1800);
  });

  it('affiche une nouvelle page depuis le haut, sans bouger pour un simple paramètre', () => {
    arrive('/ue/UTC502', null);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);

    arrive('/ue/UTC502?onglet=termes', null);

    expect(scrollTo).toHaveBeenCalledOnce();
  });
});
