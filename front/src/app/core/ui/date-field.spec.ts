import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DateField } from './date-field';
import { dateValue, setDate } from './date-field.testing';

@Component({
  imports: [DateField, ReactiveFormsModule],
  template: `
    <app-date-field fieldId="due" [formControl]="due" />
    <app-date-field fieldId="start" [formControl]="start" [clearable]="false" />
    <app-date-field fieldId="end" [formControl]="end" [durationFrom]="start.value" />
    <app-date-field
      fieldId="until"
      placeholder="Sans répétition"
      [formControl]="until"
      [withTime]="withTime()"
    />
  `,
})
class Host {
  readonly due = new FormControl('2026-11-17T18:30', { nonNullable: true });
  readonly start = new FormControl('2026-11-17T18:30', { nonNullable: true });
  readonly end = new FormControl('2026-11-17T21:30', { nonNullable: true });
  readonly until = new FormControl('', { nonNullable: true });
  readonly withTime = signal(false);
}

describe('DateField', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    document.body.append(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
  });

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  function field(id: string): HTMLElement {
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(`#${id}`);
    return trigger?.closest('app-date-field') as HTMLElement;
  }

  function open(id: string): HTMLElement {
    field(id).querySelector<HTMLButtonElement>('.trigger')?.click();
    fixture.detectChanges();
    return field(id);
  }

  function click(root: HTMLElement, label: string): void {
    Array.from(root.querySelectorAll('button'))
      .find(
        (button) =>
          button.getAttribute('aria-label') === label ||
          (button.textContent ?? '').replace(/\s+/g, ' ').trim() === label,
      )
      ?.click();
    fixture.detectChanges();
  }

  it('montre la date en clair, ou son texte quand il est vide', () => {
    expect(field('due').querySelector('.value')?.textContent).toBe('Mar. 17 nov. 2026 · 18:30');
    expect(field('until').querySelector('.value')?.textContent).toBe('Sans répétition');
    expect(field('until').querySelector('.clear')).toBeNull();
  });

  it('choisit un jour en gardant l’heure, puis une heure et des minutes', () => {
    const due = open('due');
    expect(due.querySelector('.month span')?.textContent).toBe('Novembre 2026');
    expect(due.querySelector('.day.is-selected')?.textContent?.trim()).toBe('17');

    click(due, 'vendredi 20 novembre 2026');
    expect(host.due.value).toBe('2026-11-20T18:30');
    expect(due.querySelector('.panel')).not.toBeNull();

    click(due.querySelector('[aria-label="Heure"]') as HTMLElement, '23');
    click(due.querySelector('[aria-label="Minutes"]') as HTMLElement, '45');
    expect(host.due.value).toBe('2026-11-20T23:45');

    click(due, 'Valider');
    expect(due.querySelector('.panel')).toBeNull();
    expect(due.querySelector('.value')?.textContent).toBe('Ven. 20 nov. 2026 · 23:45');
  });

  it('change de mois et se déplace aux flèches', () => {
    const due = open('due');

    click(due, 'Mois suivant');
    expect(due.querySelector('.month span')?.textContent).toBe('Décembre 2026');
    expect(host.due.value).toBe('2026-11-17T18:30');

    due
      .querySelector('.day')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    expect(host.due.value).toBe('2026-11-24T18:30');
    expect(due.querySelector('.month span')?.textContent).toBe('Novembre 2026');
  });

  it('lit la saisie au clavier et signale une date impossible', () => {
    setDate(fixture, '#due', '2026-12-15T08:00');
    expect(host.due.value).toBe('2026-12-15T08:00');
    expect(dateValue(fixture, '#due')).toBe('2026-12-15T08:00');

    const typed = open('due').querySelector('.typed') as HTMLInputElement;
    typed.value = '31/02/2027';
    typed.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(typed.getAttribute('aria-invalid')).toBe('true');
    expect(host.due.value).toBe('2026-12-15T08:00');
  });

  it('efface la date, sauf quand elle est obligatoire', () => {
    click(field('due'), 'Effacer la date');
    expect(host.due.value).toBe('');
    expect(field('due').querySelector('.value')?.textContent).toBe('Sans date');

    expect(field('start').querySelector('.clear')).toBeNull();
    const start = open('start');
    expect(start.textContent).not.toContain('Effacer');
    expect(start.textContent).not.toContain('Sans date');
  });

  it('propose la fin en durée après le début, ou un autre jour', () => {
    expect(field('end').querySelector('.value')?.textContent).toBe('21:30');

    const end = open('end');
    expect(end.querySelector('.durations .is-selected')?.textContent).toContain('3 h');
    end.querySelectorAll<HTMLButtonElement>('.durations .row')[1].click();
    fixture.detectChanges();
    expect(host.end.value).toBe('2026-11-17T19:30');
    expect(end.querySelector('.panel')).toBeNull();

    open('end');
    click(end, 'Autre heure ou autre jour…');
    click(end, 'mercredi 18 novembre 2026');
    expect(host.end.value).toBe('2026-11-18T19:30');
    expect(end.querySelector('.value')?.textContent).toBe('Mer. 18 nov. 2026 · 19:30');
  });

  it('choisit une date seule d’un clic et referme le panneau', () => {
    const until = open('until');
    expect(until.querySelector('.times')).toBeNull();
    expect(until.querySelector('.shortcuts')).toBeNull();

    click(until, 'Mois suivant');
    const firstDay = Array.from(until.querySelectorAll<HTMLButtonElement>('.day')).find(
      (day) => !day.classList.contains('is-outside'),
    );
    firstDay?.click();
    fixture.detectChanges();

    expect(host.until.value).toMatch(/^\d{4}-\d{2}-01$/);
    expect(until.querySelector('.panel')).toBeNull();
  });

  it('se ferme par Échap ou par un clic ailleurs, sans changer la valeur', () => {
    const due = open('due');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    due.querySelector('.typed')?.dispatchEvent(escape);
    fixture.detectChanges();
    expect(due.querySelector('.panel')).toBeNull();
    expect(escape.defaultPrevented).toBe(true);

    open('due');
    document.body.click();
    fixture.detectChanges();
    expect(due.querySelector('.panel')).toBeNull();
    expect(host.due.value).toBe('2026-11-17T18:30');
  });
});
