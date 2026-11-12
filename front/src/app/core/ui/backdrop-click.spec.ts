import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BackdropClick } from './backdrop-click';

@Component({
  imports: [BackdropClick],
  template: `
    <dialog appBackdropClick (backdropClick)="count.set(count() + 1)">
      <p>Contenu</p>
    </dialog>
  `,
})
class Host {
  readonly count = signal(0);
}

describe('BackdropClick', () => {
  function setup(): { host: Host; dialog: HTMLDialogElement; content: HTMLElement } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    // Cadre de la fenêtre : de (100, 100) à (300, 300).
    dialog.getBoundingClientRect = () => new DOMRect(100, 100, 200, 200);
    return {
      host: fixture.componentInstance,
      dialog,
      content: element.querySelector('p') as HTMLElement,
    };
  }

  function mouse(target: HTMLElement, type: string, x: number, y: number): void {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  }

  it('signale un clic enfoncé et relâché sur le fond', () => {
    const { host, dialog } = setup();

    mouse(dialog, 'mousedown', 20, 20);
    mouse(dialog, 'click', 20, 20);

    expect(host.count()).toBe(1);
  });

  it('ignore un clic dans la fenêtre, sur son contenu comme sur son cadre', () => {
    const { host, dialog, content } = setup();

    mouse(content, 'mousedown', 150, 150);
    mouse(content, 'click', 150, 150);
    mouse(dialog, 'mousedown', 105, 105);
    mouse(dialog, 'click', 105, 105);

    expect(host.count()).toBe(0);
  });

  it('ignore une sélection commencée dans la fenêtre et relâchée sur le fond', () => {
    const { host, dialog, content } = setup();

    mouse(content, 'mousedown', 150, 150);
    mouse(dialog, 'click', 20, 20);

    expect(host.count()).toBe(0);
  });
});
