import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlideshowViewer } from './slideshow-viewer';
import { SlideshowViewerService, ViewedSlide } from './slideshow-viewer.service';

function slide(step: number): ViewedSlide {
  const text = document.createElement('p');
  text.textContent = `Explication ${step}`;
  return {
    src: `/api/courses/1/images/${step}`,
    alt: `Schéma ${step}`,
    caption: `Étape ${step}`,
    body: [text],
  };
}

describe('SlideshowViewer', () => {
  let fixture: ComponentFixture<SlideshowViewer>;
  let service: SlideshowViewerService;
  // D'autres tests remplacent ces méthodes sans les rétablir : celui-ci pose les siennes.
  const prototype = HTMLDialogElement.prototype;
  const originals = {
    showModal: Object.getOwnPropertyDescriptor(prototype, 'showModal'),
    close: Object.getOwnPropertyDescriptor(prototype, 'close'),
  };

  beforeEach(() => {
    // jsdom n'ouvre pas les boîtes de dialogue : on simule l'ouverture et la fermeture.
    prototype.showModal = function (this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
    prototype.close = function (this: HTMLDialogElement): void {
      if (this.hasAttribute('open')) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      }
    };
    service = TestBed.inject(SlideshowViewerService);
    fixture = TestBed.createComponent(SlideshowViewer);
    fixture.detectChanges();
  });

  afterEach(() => {
    for (const [name, original] of Object.entries(originals)) {
      if (original) {
        Object.defineProperty(prototype, name, original);
      } else {
        Reflect.deleteProperty(prototype, name);
      }
    }
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function shown(): { counter?: string; title?: string; text?: string; image?: string | null } {
    return {
      counter: element().querySelector('.counter')?.textContent.trim(),
      title: element().querySelector('.step-title')?.textContent.trim(),
      text: element().querySelector('.course-content')?.textContent.trim(),
      image: element().querySelector('.stage img:not([hidden])')?.getAttribute('src'),
    };
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(element().querySelectorAll('button')).find((candidate) =>
      candidate.textContent.includes(label),
    ) as HTMLButtonElement;
  }

  function open(count: number): void {
    service.open({ title: 'Cycle', slides: Array.from({ length: count }, (_, i) => slide(i + 1)) });
    fixture.detectChanges();
  }

  it('reste fermé sans diaporama, ou pour un diaporama sans étape', () => {
    service.open({ title: 'Vide', slides: [] });
    fixture.detectChanges();

    expect(element().querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('s’ouvre à la première étape : image, titre et explication', () => {
    open(3);

    expect(element().querySelector('h2')?.textContent).toBe('Cycle');
    expect(shown()).toEqual({
      counter: '1 / 3',
      title: 'Étape 1',
      text: 'Explication 1',
      image: '/api/courses/1/images/1',
    });
    expect(button('Précédent').disabled).toBe(true);
  });

  it('avance et recule par les boutons et par les flèches, sans dépasser', () => {
    open(2);

    button('Suivant').click();
    fixture.detectChanges();
    expect(shown().counter).toBe('2 / 2');
    expect(shown().text).toBe('Explication 2');
    expect(button('Suivant').disabled).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(shown().counter).toBe('2 / 2');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    fixture.detectChanges();
    expect(shown().counter).toBe('1 / 2');
  });

  it('rouvre un autre diaporama à sa première étape', () => {
    open(3);
    button('Suivant').click();
    service.close();
    fixture.detectChanges();

    open(2);

    expect(shown().counter).toBe('1 / 2');
  });

  it('laisse les flèches à la page quand il est fermé', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
