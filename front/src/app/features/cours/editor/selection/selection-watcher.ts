import { Extension } from '@tiptap/core';
import { AllSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';

export interface SelectionWatcherOptions {
  // Sélection de texte à mettre en forme : où afficher la barre, en pixels depuis le coin
  // haut gauche de la zone de contenu (haut de la sélection, milieu de sa première ligne).
  // null : plus de sélection à mettre en forme.
  onChange: (target: { top: number; left: number } | null) => void;
}

// Position de la barre pour la sélection en cours ; null s'il n'y a rien à mettre en forme.
function locate(view: EditorView): { top: number; left: number } | null {
  const { selection } = view.state;
  const isFormattable =
    view.editable &&
    // Texte sélectionné à la souris ou au clavier, ou tout le document (Ctrl+A).
    (selection instanceof TextSelection || selection instanceof AllSelection) &&
    !selection.empty &&
    // Un bloc de code n'accepte aucune mise en forme.
    !selection.$from.parent.type.spec.code;
  if (!isFormattable) {
    return null;
  }
  try {
    const start = view.coordsAtPos(selection.from);
    const end = view.coordsAtPos(selection.to);
    const origin = (view.dom.parentElement ?? view.dom).getBoundingClientRect();
    const isOneLine = Math.abs(start.top - end.top) < 2;
    return {
      top: start.top - origin.top,
      left: (isOneLine ? (start.left + end.left) / 2 : start.left) - origin.left,
    };
  } catch {
    // Pas de mise en page disponible (environnement de test) : la barre s'affiche en haut.
    return { top: 0, left: 0 };
  }
}

// Surveille la sélection : signale où afficher la barre de mise en forme, une fois la
// sélection terminée (bouton de la souris relâché).
class SelectionWatcherView {
  private isMouseDown = false;

  constructor(
    private readonly view: EditorView,
    private readonly options: SelectionWatcherOptions,
  ) {
    view.dom.addEventListener('mousedown', this.onMouseDown);
    view.dom.ownerDocument.addEventListener('mouseup', this.onMouseUp);
    view.dom.addEventListener('blur', this.onBlur);
  }

  update(): void {
    this.options.onChange(this.isMouseDown ? null : locate(this.view));
  }

  destroy(): void {
    this.view.dom.removeEventListener('mousedown', this.onMouseDown);
    this.view.dom.ownerDocument.removeEventListener('mouseup', this.onMouseUp);
    this.view.dom.removeEventListener('blur', this.onBlur);
  }

  private readonly onMouseDown = (): void => {
    this.isMouseDown = true;
    this.options.onChange(null);
  };

  private readonly onMouseUp = (): void => {
    if (this.isMouseDown) {
      this.isMouseDown = false;
      // Après le traitement du relâchement par l'éditeur.
      setTimeout(() => this.update());
    }
  };

  // Le curseur est parti ailleurs (autre champ, modale) : la barre n'a plus lieu d'être.
  private readonly onBlur = (): void => this.options.onChange(null);
}

export const SelectionWatcher = Extension.create<SelectionWatcherOptions>({
  name: 'selectionWatcher',

  addOptions() {
    return { onChange: () => undefined };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey('selectionWatcher'),
        view: (view) => new SelectionWatcherView(view, options),
      }),
    ];
  },
});
