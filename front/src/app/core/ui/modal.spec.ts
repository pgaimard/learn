import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    @if (isOpen()) {
      <app-modal heading="Nouveau cours" (closed)="isOpen.set(false)">
        <input id="title" type="text" />
      </app-modal>
    }
  `,
})
class Host {
  readonly isOpen = signal(true);
}

describe('Modal', () => {
  it('s’ouvre avec son titre, place le curseur dans le premier champ et signale sa fermeture', async () => {
    const fixture = TestBed.createComponent(Host);
    const host = fixture.nativeElement as HTMLElement;
    document.body.append(host);
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = host.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(host.querySelector('h2')?.textContent).toBe('Nouveau cours');
    expect(dialog.getAttribute('aria-labelledby')).toBe(host.querySelector('h2')?.id);
    expect(document.activeElement?.id).toBe('title');

    host.querySelector<HTMLButtonElement>('[aria-label="Fermer la fenêtre"]')?.click();
    fixture.detectChanges();

    expect(host.querySelector('dialog')).toBeNull();
    host.remove();
  });
});
