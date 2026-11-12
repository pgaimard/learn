import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuButton } from './menu-button';

@Component({
  imports: [MenuButton],
  template: `
    <app-menu-button label="Autres actions">
      <span menuTrigger>Plus</span>
      <button type="button" role="menuitem" class="menu-item" (click)="chosen = 'un'">Un</button>
      <button type="button" role="menuitem" class="menu-item" (click)="chosen = 'deux'">
        Deux
      </button>
    </app-menu-button>
  `,
})
class Host {
  chosen = '';
}

describe('MenuButton', () => {
  let fixture: ComponentFixture<Host>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.nativeElement as HTMLElement;
    document.body.append(host);
    fixture.detectChanges();
  });

  afterEach(() => host.remove());

  const trigger = (): HTMLButtonElement =>
    host.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  const menu = (): HTMLElement => host.querySelector('[role="menu"]') as HTMLElement;
  const items = (): HTMLButtonElement[] =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  function press(key: string): void {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  it('est fermé au départ et s’ouvre sur sa première action', () => {
    expect(menu().hidden).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    open();

    expect(menu().hidden).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('lance l’action choisie et se ferme', () => {
    open();

    items()[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.chosen).toBe('deux');
    expect(menu().hidden).toBe(true);
  });

  it('parcourt les actions aux flèches, en boucle', () => {
    open();

    press('ArrowDown');
    expect(document.activeElement).toBe(items()[1]);

    press('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);

    press('ArrowUp');
    expect(document.activeElement).toBe(items()[1]);
  });

  it('se ferme sur Échap et rend le curseur au bouton', () => {
    open();

    press('Escape');

    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it('se ferme sur un clic ailleurs', () => {
    open();

    document.body.click();
    fixture.detectChanges();

    expect(menu().hidden).toBe(true);
  });
});
