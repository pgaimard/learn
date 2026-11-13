import { Extension } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { dropSection, moveUnit } from '../sections/section-commands';
import { Section, sectionAt } from '../sections/section-range';
import { blockAt, dropBlock, TopLevelBlock } from './block-commands';

export interface BlockHandleOptions {
  // Clic sur la poignée : ouvre le menu du bloc, positionné à cette hauteur
  // (en pixels depuis le haut de la zone de contenu).
  onOpenMenu: (target: { pos: number; top: number }) => void;
  // Élément dont le survol affiche la poignée, quand il est plus large que le contenu :
  // la feuille, dont la marge de gauche porte la poignée.
  hoverZone?: () => HTMLElement | null;
}

// Bloc en cours de déplacement par la poignée, partagé entre la poignée et le dépôt.
interface DragState {
  source: TopLevelBlock | null;
  // Chapitre déplacé quand le bloc est un titre.
  section: Section | null;
}

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
  private draggedElement: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly options: BlockHandleOptions,
    private readonly drag: DragState,
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
    this.handle.remove();
  }

  private createHandle(): HTMLButtonElement {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'block-handle';
    handle.draggable = true;
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
    handle.addEventListener('dragstart', (event) => this.startDrag(event));
    handle.addEventListener('dragend', () => this.endDrag());
    return handle;
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.cancelHide();
    if (!this.view.editable || event.target === this.handle) {
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

  // Le bloc est annoncé à l'éditeur comme contenu en cours de déplacement : il affiche
  // l'indicateur de dépôt. Le dépôt lui-même est traité par handleBlockDrop.
  private startDrag(event: DragEvent): void {
    const block = this.current;
    const element = block ? this.view.nodeDOM(block.pos) : null;
    if (!block || !event.dataTransfer || !(element instanceof HTMLElement)) {
      event.preventDefault();
      return;
    }
    // Un titre emporte son chapitre : tout ce qui le suit jusqu'au titre suivant de même niveau.
    const section = sectionAt(this.view.state.doc, block.pos);
    this.drag.source = block;
    this.drag.section = section;
    this.view.dragging = {
      slice: section
        ? this.view.state.doc.slice(section.from, section.to)
        : new Slice(Fragment.from(block.node), 0, 0),
      move: true,
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', block.node.textContent);
    event.dataTransfer.setDragImage(element, 0, 0);
    element.classList.add('is-dragged');
    this.draggedElement = element;
  }

  private endDrag(): void {
    // Glisser terminé ou abandonné : rien ne doit rester « en cours de déplacement ».
    this.drag.source = null;
    this.drag.section = null;
    this.view.dragging = null;
    this.draggedElement?.classList.remove('is-dragged');
    this.draggedElement = null;
  }
}

// Dépôt d'un bloc déplacé par sa poignée. Le bloc est retiré puis réinséré par nos soins :
// le traitement par défaut passe par la sélection, qu'un tableau transforme en sélection
// de cellules, ce qui viderait le tableau au lieu de le déplacer.
function handleBlockDrop(view: EditorView, event: DragEvent, drag: DragState): boolean {
  const source = drag.source;
  if (!source) {
    return false;
  }
  const section = drag.section;
  drag.source = null;
  drag.section = null;
  const aimed = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const current = blockAt(view.state.doc, source.pos);
  const transaction =
    !aimed || current?.node !== source.node
      ? null
      : section
        ? dropSection(view.state, section, aimed.pos)
        : dropBlock(view.state, current, aimed.pos);
  if (transaction) {
    view.dispatch(transaction.scrollIntoView());
  }
  return true;
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
    const drag: DragState = { source: null, section: null };
    return [
      new Plugin({
        key: new PluginKey('blockHandle'),
        view: (view) => new BlockHandleView(view, options, drag),
        props: { handleDrop: (view, event) => handleBlockDrop(view, event, drag) },
      }),
    ];
  },
});
