import { ComponentFixture } from '@angular/core/testing';

// Aide de test : choisit une option d'une liste déroulante comme le ferait un clic,
// en ouvrant d'abord la liste. Le bouton est désigné par un sélecteur CSS.
export function pickOption(
  fixture: ComponentFixture<unknown>,
  triggerSelector: string,
  value: string,
): void {
  const root = fixture.nativeElement as HTMLElement;
  const trigger = root.querySelector<HTMLButtonElement>(triggerSelector);
  if (!trigger) {
    throw new Error(`Liste déroulante introuvable : ${triggerSelector}`);
  }
  trigger.click();
  fixture.detectChanges();
  const option = Array.from(
    trigger.closest('app-dropdown')?.querySelectorAll<HTMLButtonElement>('.option') ?? [],
  ).find((candidate) => candidate.dataset['value'] === value);
  if (!option) {
    throw new Error(`Option « ${value} » introuvable dans ${triggerSelector}`);
  }
  option.click();
  fixture.detectChanges();
}
