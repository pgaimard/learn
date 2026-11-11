import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UeForm } from './ue-form';
import { Ue, UeInput } from './ue.service';

describe('UeForm', () => {
  let fixture: ComponentFixture<UeForm>;
  let saved: UeInput[];

  function setup(ue: Ue | null = null): void {
    fixture = TestBed.createComponent(UeForm);
    fixture.componentRef.setInput('ue', ue);
    saved = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function fill(id: string, value: string): void {
    const field = element().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
  }

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('émet une UE au code normalisé, sans ordre quand il est vide', () => {
    setup();
    fill('ue-code', ' utc502 ');
    fill('ue-title', ' Systèmes d’exploitation ');

    submit();

    expect(saved).toEqual([{ code: 'UTC502', title: 'Systèmes d’exploitation', description: '' }]);
  });

  it('n’émet rien et signale les champs requis quand le formulaire est incomplet', () => {
    setup();
    fill('ue-code', 'x');

    submit();

    expect(saved).toEqual([]);
    expect(element().textContent).toContain('De 3 à 10 lettres ou chiffres');
    expect(element().textContent).toContain('L’intitulé est requis');
  });

  it('préremplit le formulaire pour une modification', () => {
    setup({ id: 1, code: 'NFE108', title: 'Méthodologies', description: 'Merise', position: 4 });

    submit();

    expect(saved).toEqual([{ code: 'NFE108', title: 'Méthodologies', description: 'Merise' }]);
    // L'ordre ne se saisit plus : il se règle en faisant glisser les UE dans la liste.
    expect(element().querySelector('#ue-position')).toBeNull();
  });
});
