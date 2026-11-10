import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { UeListPage } from './features/ue/ue-list-page';

describe('routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('charge en différé la liste des UE sur la page d’accueil', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/', UeListPage);

    expect(page).toBeInstanceOf(UeListPage);
  });

  it('redirige une adresse inconnue vers la page d’accueil', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/adresse-inconnue');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
