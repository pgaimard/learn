import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageViewer } from './image-viewer';
import { ImageViewerService } from './image-viewer.service';

describe('ImageViewer', () => {
  let fixture: ComponentFixture<ImageViewer>;
  let service: ImageViewerService;
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
    service = TestBed.inject(ImageViewerService);
    fixture = TestBed.createComponent(ImageViewer);
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

  function dialog(): HTMLDialogElement {
    return (fixture.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;
  }

  function show(caption: string): void {
    service.open({ src: '/api/courses/7/images/4', alt: 'États d’un processus', caption });
    fixture.detectChanges();
  }

  it('reste fermée tant qu’aucune image n’est demandée', () => {
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(dialog().querySelector('img')).toBeNull();
  });

  it('montre l’image avec sa légende pour titre, à défaut son texte de remplacement', () => {
    show('Figure 1 – états');

    expect(dialog().hasAttribute('open')).toBe(true);
    expect(dialog().querySelector('img')?.getAttribute('src')).toBe('/api/courses/7/images/4');
    expect(dialog().querySelector('img')?.getAttribute('alt')).toBe('États d’un processus');
    expect(dialog().querySelector('h2')?.textContent).toBe('Figure 1 – états');

    show('');
    expect(dialog().querySelector('h2')?.textContent).toBe('États d’un processus');
  });

  it('se ferme par son bouton, par un clic sur l’image, par Échap ou par un clic en dehors', () => {
    show('');
    dialog().querySelector<HTMLButtonElement>('[aria-label="Fermer la fenêtre"]')?.click();
    fixture.detectChanges();
    expect(dialog().hasAttribute('open')).toBe(false);

    show('');
    dialog().querySelector('img')?.click();
    fixture.detectChanges();
    expect(dialog().hasAttribute('open')).toBe(false);

    show('');
    dialog().close();
    fixture.detectChanges();
    expect(service.image()).toBeNull();

    show('');
    dialog().getBoundingClientRect = () => new DOMRect(100, 100, 200, 200);
    for (const type of ['mousedown', 'click']) {
      dialog().dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 20, clientY: 20 }));
    }
    fixture.detectChanges();
    expect(service.image()).toBeNull();
  });
});
