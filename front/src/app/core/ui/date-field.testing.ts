import { ComponentFixture } from '@angular/core/testing';

// Aide de test : pose la valeur d'un sélecteur de date par sa saisie au clavier, en
// ouvrant d'abord le panneau. Le bouton est désigné par un sélecteur CSS ; la valeur a le
// format du champ (« AAAA-MM-JJ » ou « AAAA-MM-JJTHH:MM »), ou est vide pour l'effacer.
export function setDate(
  fixture: ComponentFixture<unknown>,
  triggerSelector: string,
  value: string,
): void {
  const root = fixture.nativeElement as HTMLElement;
  const trigger = root.querySelector<HTMLButtonElement>(triggerSelector);
  if (!trigger) {
    throw new Error(`Sélecteur de date introuvable : ${triggerSelector}`);
  }
  trigger.click();
  fixture.detectChanges();
  const field = trigger.closest('app-date-field');
  // Une fin proposée en durée montre d'abord la liste des durées.
  field?.querySelector<HTMLButtonElement>('.durations .is-quiet')?.click();
  fixture.detectChanges();
  const typed = field?.querySelector<HTMLInputElement>('.typed');
  if (!typed) {
    throw new Error(`Saisie au clavier introuvable dans ${triggerSelector}`);
  }
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');
  typed.value = value === '' ? '' : `${day}/${month}/${year}${time ? ` ${time}` : ''}`;
  typed.dispatchEvent(new Event('change'));
  fixture.detectChanges();
  // Referme le panneau, comme un clic ailleurs dans la page.
  document.body.click();
  fixture.detectChanges();
}

// Valeur d'un sélecteur de date, au format du champ.
export function dateValue(fixture: ComponentFixture<unknown>, triggerSelector: string): string {
  const root = fixture.nativeElement as HTMLElement;
  return root.querySelector<HTMLElement>(triggerSelector)?.dataset['value'] ?? '';
}
