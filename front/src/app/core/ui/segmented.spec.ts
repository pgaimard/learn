import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Segmented } from './segmented';

@Component({
  imports: [ReactiveFormsModule, Segmented],
  template: `<app-segmented label="Type" [options]="options" [formControl]="type" />`,
})
class Host {
  readonly options = [
    { value: 'course', label: 'Cours' },
    { value: 'deadline', label: 'Échéance' },
  ];
  readonly type = new FormControl('course', { nonNullable: true });
}

describe('Segmented', () => {
  it('marque la valeur du champ et la change au clic', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    const pressed = (): (string | null)[] =>
      buttons.map((button) => button.getAttribute('aria-pressed'));

    expect(pressed()).toEqual(['true', 'false']);

    buttons[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.type.value).toBe('deadline');
    expect(pressed()).toEqual(['false', 'true']);
  });
});
