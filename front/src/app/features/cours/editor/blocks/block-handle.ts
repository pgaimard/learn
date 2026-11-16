import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { moveSectionTo, moveUnit } from '../sections/section-commands';
import { Section, sectionAt } from '../sections/section-range';
import { blockAt, moveBlockTo, TopLevelBlock } from './block-commands';
import {
  BlockDrag,
  blockDragKey,
  blockDragPlugin,
  boundaryAt,
  DropCandidate,
  isUseful,
} from './block-drag';

export interface BlockHandleOptions {
  // Clic sur la poignée : ouvre le menu du bloc, positionné à cette hauteur
  // (en pixels depuis le haut de la zone de contenu).
  onOpenMenu: (target: { pos: number; top: number }) => void;
  // Élément dont le survol affiche la poignée, quand il est plus large que le contenu :
  // la feuille, dont la marge de gauche porte la poignée.
  hoverZone?: () => HTMLElement | null;
}

// Bloc saisi par la poignée, tant que la souris est enfoncée.
interface Grab {
  source: TopLevelBlock;
  // Chapitre déplacé quand le bloc est un titre.
  section: Section | null;
  // Où la souris a été enfoncée : le glisser ne commence qu'un peu plus loin.
  startX: number;
  startY: number;
  // Aperçu qui suit la souris ; null tant que le glisser n'a pas commencé.
  preview: HTMLElement | null;
  pointerX: number;
  pointerY: number;
  scrollFrame: number | null;
}

// Distance, en pixels, à partir de laquelle un appui sur la poignée devient un glisser.
const DRAG_THRESHOLD = 4;
// Bande, en haut et en bas de la fenêtre, où la page défile pendant le glisser.
const SCROLL_EDGE = 72;
const SCROLL_STEP = 14;
// La case d'arrivée a la hauteur de ce qui est déplacé, dans ces limites.
const MIN_SLOT_HEIGHT = 36;
const MAX_SLOT_HEIGHT = 140;
// Types de blocs dans lesquels un bloc peut être déposé, en plus du document.
const CONTAINERS = ['callout'];

// Délai avant de cacher la poignée : le temps, pour la souris, de traverser la marge
// qui sépare le texte de la poignée.
const HIDE_DELAY_MS = 300;

const HANDLE_LABEL = 'Faire glisser pour déplacer le bloc ; clic droit pour son menu';

// Poignée affichée à gauche du bloc survolé. On la fait glisser pour déplacer le bloc ;
// un clic droit ouvre son menu. Elle vit hors du contenu éditable : ProseMirror ne la voit pas.
class BlockHandleView {
  private readonly handle: HTMLButtonElement;
  private readonly container: HTMLElement;
  // Zone dont le survol affiche la poignée : la feuille, marges comprises.
  private readonly hoverZone: HTMLElement;
  private current: TopLevelBlock | null = null;
  private grab: Grab | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly options: BlockHandleOptions,
  ) {
    this.container = view.dom.parentElement ?? view.dom;
    this.handle = this.createHandle();
    this.hoverZone = options.hoverZone?.() ?? this.container;
    this.container.append(this.handle);
    this.hoverZone.addEventListener('mousemove', this.onMouseMove);
    this.hoverZone.addEventListener('mouseleave', this.onMouseLeave);
  }

  update(): void {
    // Le document a pu changer sous la poignée : on la replace sur le même bloc, ou on la cache.
    const block = this.current ? blockAt(this.view.state.doc, this.current.pos) : null;
    this.show(this.view.editable && block?.pos === this.current?.pos ? block : null);
  }

  destroy(): void {
    this.hoverZone.removeEventListener('mousemove', this.onMouseMove);
    this.hoverZone.removeEventListener('mouseleave', this.onMouseLeave);
    this.cancelHide();
    this.endGrab();
    this.handle.remove();
  }

  private createHandle(): HTMLButtonElement {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'block-handle';
    handle.hidden = true;
    handle.setAttribute('aria-label', HANDLE_LABEL);
    handle.title = 'Glisser pour déplacer, clic droit pour le menu';
    handle.textContent = '⋮⋮';
    // Le clic gauche est réservé au glisser : le menu s'ouvre au clic droit
    // (ou par la touche de menu du clavier).
    handle.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.openMenu();
    });
    // La poignée est hors du texte : la souris qui s'y trouve ne « quitte » pas le bloc.
    handle.addEventListener('mouseenter', () => this.cancelHide());
    handle.addEventListener('mouseleave', () => this.hideSoon());
    handle.addEventListener('mousedown', (event) => this.startGrab(event));
    return handle;
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.cancelHide();
    // Pendant un glisser, la poignée reste sur le bloc saisi.
    if (!this.view.editable || event.target === this.handle || this.grab) {
      return;
    }
    const content = this.view.dom.getBoundingClientRect();
    // Au-dessus ou au-dessous du contenu (en-tête de la feuille), aucun bloc n'est visé.
    if (event.clientY < content.top || event.clientY > content.bottom) {
      return;
    }
    // On vise l'intérieur du contenu, à la hauteur de la souris : la poignée elle-même
    // et les marges, d'où la souris l'atteint, sont hors du texte.
    const found = this.view.posAtCoords({ left: content.left + 8, top: event.clientY });
    if (found) {
      this.show(blockAt(this.view.state.doc, found.inside >= 0 ? found.inside : found.pos));
    }
  };

  private readonly onMouseLeave = (): void => this.hideSoon();

  private hideSoon(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.show(null), HIDE_DELAY_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private show(block: TopLevelBlock | null): void {
    const element = block ? this.view.nodeDOM(block.pos) : null;
    this.current = element instanceof HTMLElement ? block : null;
    this.handle.hidden = this.current === null;
    if (element instanceof HTMLElement) {
      this.handle.style.top = `${this.offsetOf(element)}px`;
    }
  }

  private offsetOf(element: HTMLElement): number {
    return element.getBoundingClientRect().top - this.container.getBoundingClientRect().top;
  }

  private openMenu(): void {
    if (this.current) {
      this.options.onOpenMenu({
        pos: this.current.pos,
        top: Number.parseFloat(this.handle.style.top) || 0,
      });
    }
  }

  // Appui sur la poignée : le bloc est saisi. Le glisser est suivi dans toute la page,
  // sans le glisser-déposer du navigateur, pour montrer l'aperçu et la case d'arrivée.
  private startGrab(event: MouseEvent): void {
    const source = this.current;
    if (event.button !== 0 || !source) {
      return;
    }
    // Ni sélection de texte, ni perte du curseur de l'éditeur.
    event.preventDefault();
    this.grab = {
      source,
      // Un titre emporte son chapitre : tout ce qui le suit jusqu'au titre suivant de même niveau.
      section: sectionAt(this.view.state.doc, source.pos),
      startX: event.clientX,
      startY: event.clientY,
      preview: null,
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollFrame: null,
    };
    document.addEventListener('mousemove', this.onGrabMove);
    document.addEventListener('mouseup', this.onGrabEnd);
    document.addEventListener('keydown', this.onGrabKey);
  }

  private readonly onGrabMove = (event: MouseEvent): void => {
    const grab = this.grab;
    if (!grab) {
      return;
    }
    grab.pointerX = event.clientX;
    grab.pointerY = event.clientY;
    if (!grab.preview) {
      const distance = Math.hypot(event.clientX - grab.startX, event.clientY - grab.startY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }
      grab.preview = this.createPreview(grab);
      grab.scrollFrame = requestAnimationFrame(this.scrollNearEdges);
    }
    this.followPointer(grab);
  };

  // Lâcher : le bloc va dans la case d'arrivée, s'il y en a une.
  private readonly onGrabEnd = (): void => {
    const grab = this.grab;
    const target = blockDragKey.getState(this.view.state)?.target ?? null;
    this.endGrab();
    if (!grab || target === null) {
      return;
    }
    const { state } = this.view;
    const transaction = grab.section
      ? moveSectionTo(state, grab.section, target)
      : moveBlockTo(state, grab.source, target);
    if (transaction) {
      this.view.dispatch(transaction);
      this.view.focus();
    }
  };

  private readonly onGrabKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.endGrab();
    }
  };

  // Près du haut ou du bas de la fenêtre, la page défile tant que la souris y reste.
  private readonly scrollNearEdges = (): void => {
    const grab = this.grab;
    if (!grab?.preview) {
      return;
    }
    const step =
      grab.pointerY < SCROLL_EDGE
        ? -SCROLL_STEP
        : grab.pointerY > window.innerHeight - SCROLL_EDGE
          ? SCROLL_STEP
          : 0;
    if (step !== 0) {
      window.scrollBy(0, step);
      this.followPointer(grab);
    }
    grab.scrollFrame = requestAnimationFrame(this.scrollNearEdges);
  };

  private endGrab(): void {
    const grab = this.grab;
    this.grab = null;
    document.removeEventListener('mousemove', this.onGrabMove);
    document.removeEventListener('mouseup', this.onGrabEnd);
    document.removeEventListener('keydown', this.onGrabKey);
    if (!grab) {
      return;
    }
    if (grab.scrollFrame !== null) {
      cancelAnimationFrame(grab.scrollFrame);
    }
    grab.preview?.remove();
    if (blockDragKey.getState(this.view.state)) {
      this.view.dispatch(this.view.state.tr.setMeta(blockDragKey, null));
    }
  }

  // Copie du bloc saisi, qui suit la souris. Pour un chapitre, son titre et le nombre de
  // blocs qu'il emporte.
  private createPreview(grab: Grab): HTMLElement {
    const preview = document.createElement('div');
    preview.className = 'block-drag-preview';
    const element = this.view.nodeDOM(grab.source.pos);
    if (element instanceof HTMLElement) {
      preview.style.width = `${element.offsetWidth}px`;
      preview.append(element.cloneNode(true));
    }
    const carried = grab.section ? grab.section.endIndex - grab.section.index - 1 : 0;
    if (carried > 0) {
      const count = document.createElement('p');
      count.className = 'block-drag-count';
      count.textContent = carried === 1 ? 'et 1 bloc' : `et ${carried} blocs`;
      preview.append(count);
    }
    // À côté du contenu, hors de la zone éditable : l'aperçu reçoit la mise en forme du
    // cours sans que l'éditeur le prenne pour une saisie.
    this.container.append(preview);
    return preview;
  }

  // Place l'aperçu sous la souris et la case d'arrivée à la frontière la plus proche.
  private followPointer(grab: Grab): void {
    if (grab.preview) {
      grab.preview.style.left = `${grab.pointerX + 12}px`;
      grab.preview.style.top = `${grab.pointerY + 8}px`;
    }
    const from = grab.section?.from ?? grab.source.pos;
    const to = grab.section?.to ?? grab.source.pos + grab.source.node.nodeSize;
    const boundary = boundaryAt(this.candidatesAt(grab), grab.pointerY);
    const drag: BlockDrag = {
      from,
      to,
      target: isUseful({ from, to }, boundary) ? boundary : null,
      slotHeight: this.slotHeight(grab),
    };
    const shown = blockDragKey.getState(this.view.state);
    if (shown?.target !== drag.target || shown.from !== drag.from) {
      this.view.dispatch(this.view.state.tr.setMeta(blockDragKey, drag));
    }
  }

  private slotHeight(grab: Grab): number {
    const element = this.view.nodeDOM(grab.source.pos);
    const height = element instanceof HTMLElement ? element.offsetHeight : MIN_SLOT_HEIGHT;
    return Math.min(MAX_SLOT_HEIGHT, Math.max(MIN_SLOT_HEIGHT, height));
  }

  // Blocs parmi lesquels le dépôt se fait : ceux de l'encadré survolé, s'il accepte le
  // bloc, sinon ceux du document. Un chapitre ne se dépose qu'entre les blocs du document.
  private candidatesAt(grab: Grab): DropCandidate[] {
    const { doc } = this.view.state;
    const container = grab.section ? null : this.containerAt(grab);
    const parent = container?.node ?? doc;
    const start = container ? container.pos + 1 : 0;
    const candidates: DropCandidate[] = [];
    parent.forEach((node, offset) => {
      const element = this.view.nodeDOM(start + offset);
      // Un bloc caché (chapitre replié) n'occupe aucune place : rien ne se dépose devant lui.
      if (element instanceof HTMLElement && element.offsetHeight > 0) {
        const box = element.getBoundingClientRect();
        candidates.push({
          pos: start + offset,
          size: node.nodeSize,
          top: box.top,
          bottom: box.bottom,
        });
      }
    });
    return candidates;
  }

  // Encadré sous la souris qui peut recevoir le bloc saisi ; null s'il n'y en a pas, ou si
  // c'est le bloc saisi lui-même.
  private containerAt(grab: Grab): { pos: number; node: ProseMirrorNode } | null {
    const { doc } = this.view.state;
    const hovered = blockAt(doc, this.posUnderPointer(grab) ?? -1);
    if (
      !hovered ||
      hovered.pos === grab.source.pos ||
      !CONTAINERS.includes(hovered.node.type.name) ||
      !hovered.node.type.contentMatch.matchType(grab.source.node.type)
    ) {
      return null;
    }
    // Sur le bord haut ou bas de l'encadré, on vise l'espace entre les blocs du document.
    const element = this.view.nodeDOM(hovered.pos);
    if (!(element instanceof HTMLElement)) {
      return null;
    }
    const box = element.getBoundingClientRect();
    const edge = Math.min(10, box.height / 4);
    return grab.pointerY < box.top + edge || grab.pointerY > box.bottom - edge ? null : hovered;
  }

  private posUnderPointer(grab: Grab): number | null {
    const content = this.view.dom.getBoundingClientRect();
    const found = this.view.posAtCoords({ left: content.left + 8, top: grab.pointerY });
    return found ? (found.inside >= 0 ? found.inside : found.pos) : null;
  }
}

// Poignée de bloc et raccourcis pour monter ou descendre le bloc du curseur.
export const BlockHandle = Extension.create<BlockHandleOptions>({
  name: 'blockHandle',

  addOptions() {
    return { onOpenMenu: () => undefined };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': ({ editor }) => moveUnit(editor, editor.state.selection.from, -1),
      'Alt-Shift-ArrowDown': ({ editor }) => moveUnit(editor, editor.state.selection.from, 1),
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey('blockHandle'),
        view: (view) => new BlockHandleView(view, options),
      }),
      blockDragPlugin(),
    ];
  },
});
