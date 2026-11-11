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
});
