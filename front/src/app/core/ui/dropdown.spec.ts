import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Dropdown, DropdownOption } from './dropdown';

@Component({
  imports: [Dropdown, ReactiveFormsModule],
  template: `
    <app-dropdown label="UE" [options]="options" [searchable]="searchable()" [formControl]="ue" />
    <button type="button" class="elsewhere">Ailleurs</button>
  `,
})
class Host {
  readonly options: DropdownOption[] = [
    { value: '', label: 'Aucune' },
    { value: 'UTC502', code: 'UTC502', label: 'Systèmes d’exploitation' },
    { value: 'RSX101', code: 'RSX101', label: 'Réseaux' },
  ];
  readonly ue = new FormControl('UTC502', { nonNullable: true });
  readonly searchable = signal(false);
}

describe('Dropdown', () => {
  let fixture: ComponentFixture<Host>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return host.querySelector('.trigger') as HTMLButtonElement;
  }

  function options(): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('.option'));
  }

  function press(key: string): void {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  it('montre la valeur du champ, avec son code', () => {
    expect(trigger().textContent.replace(/\s+/g, ' ').trim()).toBe(
      'UTC502 Systèmes d’exploitation',
    );
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(options()).toHaveLength(0);
  });

  it('s’ouvre au clic sur l’option choisie et la marque', () => {
    open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(options()[1].classList).toContain('is-active');
  });

  it('choisit une option au clic, met le champ à jour et se ferme', () => {
    open();

    options()[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.ue.value).toBe('RSX101');
    expect(options()).toHaveLength(0);
    expect(trigger().textContent).toContain('Réseaux');
  });

  it('se pilote au clavier : flèches, Entrée', () => {
    press('ArrowDown');
    expect(options()).toHaveLength(3);

    press('ArrowDown');
    press('ArrowDown');
    press('ArrowDown');
    expect(options()[2].classList).toContain('is-active');

    press('ArrowUp');
    press('ArrowUp');
    press('Enter');

    expect(fixture.componentInstance.ue.value).toBe('');
    expect(options()).toHaveLength(0);
  });

  it('se ferme sur Échap sans changer la valeur ni laisser passer la touche', () => {
    open();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const seenOutside = vi.fn();
    host.addEventListener('keydown', seenOutside);

    trigger().dispatchEvent(escape);
    fixture.detectChanges();

    expect(options()).toHaveLength(0);
    expect(fixture.componentInstance.ue.value).toBe('UTC502');
    expect(seenOutside).not.toHaveBeenCalled();
  });

  it('se ferme sur un clic ailleurs', () => {
    open();

    (host.querySelector('.elsewhere') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(options()).toHaveLength(0);
  });

  it('suit la valeur posée par le formulaire et son état désactivé', () => {
    fixture.componentInstance.ue.setValue('RSX101');
    fixture.componentInstance.ue.disable();
    fixture.detectChanges();

    expect(trigger().textContent).toContain('Réseaux');
    expect(trigger().disabled).toBe(true);
  });

  it('n’annonce un changement que sur un choix de l’utilisateur', () => {
    const changes: string[] = [];
    const dropdown = fixture.debugElement.children[0].componentInstance as Dropdown;
    dropdown.valueChange.subscribe((value) => changes.push(value));

    fixture.componentInstance.ue.setValue('RSX101');
    fixture.detectChanges();
    expect(changes).toEqual([]);

    open();
    options()[0].click();
    expect(changes).toEqual(['']);
  });

  it('filtre par la recherche, sans tenir compte des accents ni de la casse', () => {
    fixture.componentInstance.searchable.set(true);
    fixture.detectChanges();
    open();
    const search = host.querySelector('.search') as HTMLInputElement;

    search.value = 'RESEAU';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(options().map((option) => option.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'RSX101Réseaux',
    ]);

    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelector('.empty')?.textContent).toBe('Aucun résultat');
  });
});
