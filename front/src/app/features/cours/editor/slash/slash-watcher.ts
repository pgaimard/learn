import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';

// « / » en début de paragraphe ou après un espace, suivi du début d'un nom de bloc.
const TRIGGER = /(?:^|\s)\/([\p{L}\p{N}-]*)$/u;
const MENU_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'];

export interface SlashTrigger {
  // Texte saisi après le « / ».
  query: string;
  // Étendue du « /mot » dans le document.
  from: number;
  to: number;
  // Où afficher le menu : sous le « / », en pixels depuis le coin haut gauche de la zone.
  top: number;
  left: number;
}

export interface SlashWatcherOptions {
  // « / » en cours de saisie, ou null quand il n'y en a plus.
  onChange: (trigger: SlashTrigger | null) => void;
  // Touche de navigation du menu ; renvoie true si le menu l'a traitée.
  onKey: (key: string) => boolean;
}

function locate(view: EditorView): SlashTrigger | null {
  const { selection } = view.state;
  const { $from } = selection;
  if (!view.editable || !selection.empty || $from.parent.type.name !== 'paragraph') {
    return null;
  }
  // ￼ tient la place des nœuds qui ne sont pas du texte (saut de ligne).
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = TRIGGER.exec(before);
  if (!match) {
    return null;
  }
  const to = $from.pos;
  const from = to - match[1].length - 1;
  let place = { top: 0, left: 0 };
  try {
    const caret = view.coordsAtPos(from);
    const origin = (view.dom.parentElement ?? view.dom).getBoundingClientRect();
    place = { top: caret.bottom - origin.top, left: caret.left - origin.left };
  } catch {
    // Pas de mise en page disponible (environnement de test).
  }
  return { query: match[1], from, to, ...place };
}

class SlashWatcherView {
  // « / » que l'utilisateur a refermé avec Échap : il ne rouvre pas le menu.
  private dismissed: number | null = null;
  private current: SlashTrigger | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly options: SlashWatcherOptions,
  ) {
    view.dom.addEventListener('blur', this.onBlur);
  }

  update(): void {
    const trigger = locate(this.view);
    if (!trigger || trigger.from !== this.dismissed) {
      this.dismissed = null;
    }
    this.show(trigger && trigger.from !== this.dismissed ? trigger : null);
  }

  destroy(): void {
    this.view.dom.removeEventListener('blur', this.onBlur);
  }

  handleKey(event: KeyboardEvent): boolean {
    if (!this.current || !MENU_KEYS.includes(event.key)) {
      return false;
    }
    if (event.key === 'Escape') {
      this.dismissed = this.current.from;
      this.show(null);
      return true;
    }
    return this.options.onKey(event.key);
  }

  private show(trigger: SlashTrigger | null): void {
    this.current = trigger;
    this.options.onChange(trigger);
  }

  private readonly onBlur = (): void => this.show(null);
}

// Menu « / » : taper « / » dans un paragraphe propose les blocs à insérer.
export const SlashWatcher = Extension.create<SlashWatcherOptions>({
  name: 'slashWatcher',
  // Avant les raccourcis des listes et des blocs : Entrée choisit dans le menu.
  priority: 1000,

  addOptions() {
    return { onChange: () => undefined, onKey: () => false };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    let watcher: SlashWatcherView | null = null;
    return [
      new Plugin({
        key: new PluginKey('slashWatcher'),
        view: (view) => {
          watcher = new SlashWatcherView(view, options);
          return watcher;
        },
        props: {
          handleKeyDown: (_view, event) => watcher?.handleKey(event) ?? false,
        },
      }),
    ];
  },
});
