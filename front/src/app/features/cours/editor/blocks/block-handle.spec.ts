import { Editor } from '@tiptap/core';
import { createCourseExtensions } from '../../content/course-extensions';

describe('poignée de bloc', () => {
  let editor: Editor;
  let container: HTMLElement;
  let opened: { pos: number; top: number }[];

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    opened = [];
    editor = new Editor({
      element: container,
      extensions: createCourseExtensions({
        blockHandle: { onOpenMenu: (target) => opened.push(target) },
        tableTools: { onOpenMenu: () => undefined },
        selection: { onChange: () => undefined, onCodeBlock: () => undefined },
        slash: { onChange: () => undefined, onKey: () => false },
      }),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'un' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'deux' }] },
        ],
      },
    });
    // jsdom ne calcule pas de mise en page : le survol désigne toujours le second bloc.
    editor.view.posAtCoords = () => ({ pos: 6, inside: 4 });
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
    vi.useRealTimers();
  });

  function handle(): HTMLButtonElement {
    return container.querySelector('.block-handle') as HTMLButtonElement;
  }

  function hover(): void {
    container.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  }

  it('apparaît au survol d’un bloc', () => {
    expect(handle().hidden).toBe(true);

    hover();

    expect(handle().hidden).toBe(false);
  });

  it('apparaît aussi au survol de la marge qui la porte', () => {
    const sheet = document.createElement('div');
    const content = document.createElement('div');
    sheet.append(content);
    document.body.append(sheet);
    const wide = new Editor({
      element: content,
      extensions: createCourseExtensions({
        blockHandle: { onOpenMenu: () => undefined, hoverZone: () => sheet },
        tableTools: { onOpenMenu: () => undefined },
        selection: { onChange: () => undefined, onCodeBlock: () => undefined },
        slash: { onChange: () => undefined, onKey: () => false },
      }),
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    wide.view.posAtCoords = () => ({ pos: 1, inside: 0 });
    const wideHandle = content.querySelector('.block-handle') as HTMLButtonElement;

    sheet.dispatchEvent(new MouseEvent('mousemove'));

    expect(wideHandle.hidden).toBe(false);
    wide.destroy();
    sheet.remove();
  });

  it('reste affichée le temps que la souris la rejoigne', () => {
    hover();

    container.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(150);
    expect(handle().hidden).toBe(false);

    handle().dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(2000);
    expect(handle().hidden).toBe(false);
  });

  it('disparaît peu après que la souris a quitté l’éditeur', () => {
    hover();

    container.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(600);

    expect(handle().hidden).toBe(true);
  });

  it('disparaît peu après que la souris a quitté la poignée', () => {
    hover();
    handle().dispatchEvent(new MouseEvent('mouseenter'));

    handle().dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(600);

    expect(handle().hidden).toBe(true);
  });

  it('ouvre le menu du bloc survolé au clic droit, pas au clic gauche', () => {
    hover();

    handle().click();
    expect(opened).toEqual([]);

    const rightClick = new MouseEvent('contextmenu', { cancelable: true });
    handle().dispatchEvent(rightClick);

    expect(opened).toEqual([{ pos: 4, top: 0 }]);
    // Le menu du navigateur ne s'ouvre pas par-dessus.
    expect(rightClick.defaultPrevented).toBe(true);
  });

  describe('glisser', () => {
    // jsdom ne calcule pas de mise en page : chaque bloc reçoit une hauteur de 40 px,
    // « un » de 0 à 40, « deux » de 40 à 80.
    function layOut(): void {
      Array.from(editor.view.dom.children).forEach((element, index) => {
        Object.defineProperty(element, 'offsetHeight', { value: 40, configurable: true });
        element.getBoundingClientRect = () =>
          ({ top: index * 40, bottom: index * 40 + 40, height: 40, left: 0 }) as DOMRect;
      });
    }

    function mouse(type: string, clientY: number, target: EventTarget = document): MouseEvent {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 });
      target.dispatchEvent(event);
      return event;
    }

    function texts(): string[] {
      const found: string[] = [];
      editor.state.doc.forEach((node) => found.push(node.textContent));
      return found;
    }

    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', () => 1);
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
      hover();
      layOut();
    });

    afterEach(() => vi.unstubAllGlobals());

    it('montre l’aperçu et la case d’arrivée, puis dépose le bloc où elle se trouve', () => {
      const down = mouse('mousedown', 60, handle());
      expect(down.defaultPrevented).toBe(true);
      mouse('mousemove', 61);
      expect(container.querySelector('.block-drag-preview')).toBeNull();

      // Au-dessus du milieu de « un » : la case passe devant lui.
      mouse('mousemove', 10);
      layOut();

      expect(container.querySelector('.block-drag-preview')?.textContent).toBe('deux');
      expect(container.querySelector('.is-dragged')?.textContent).toBe('deux');
      expect(container.querySelector('.block-drop-slot')?.nextElementSibling?.textContent).toBe(
        'un',
      );

      mouse('mouseup', 10);

      expect(texts()).toEqual(['deux', 'un']);
      expect(container.querySelector('.block-drag-preview')).toBeNull();
      expect(container.querySelector('.block-drop-slot')).toBeNull();
    });

    it('ne montre pas de case là où le dépôt ne changerait rien', () => {
      mouse('mousedown', 60, handle());
      mouse('mousemove', 75);

      expect(container.querySelector('.block-drag-preview')).not.toBeNull();
      expect(container.querySelector('.block-drop-slot')).toBeNull();

      mouse('mouseup', 75);
      expect(texts()).toEqual(['un', 'deux']);
    });

    it('abandonne le glisser avec Échap', () => {
      mouse('mousedown', 60, handle());
      mouse('mousemove', 10);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      mouse('mouseup', 10);

      expect(texts()).toEqual(['un', 'deux']);
      expect(container.querySelector('.block-drag-preview')).toBeNull();
      expect(container.querySelector('.is-dragged')).toBeNull();
    });
  });
});
