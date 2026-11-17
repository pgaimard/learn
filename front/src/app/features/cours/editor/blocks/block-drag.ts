import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Glisser d'un bloc par sa poignée : ce qui est déplacé (de from à to) et la frontière où
// il serait déposé ; target est null quand le dépôt ne changerait rien.
export interface BlockDrag {
  from: number;
  to: number;
  target: number | null;
  // Hauteur de la case d'arrivée, en pixels.
  slotHeight: number;
}

// Bloc visible parmi lesquels on dépose : sa position, sa taille dans le document et
// l'étendue verticale de son élément à l'écran.
export interface DropCandidate {
  pos: number;
  size: number;
  top: number;
  bottom: number;
}

// Frontière la plus proche de la souris : avant le premier bloc dont le milieu est sous
// elle, sinon après le dernier. Null sans aucun bloc.
export function boundaryAt(candidates: DropCandidate[], pointerY: number): number | null {
  const last = candidates.at(-1);
  if (!last) {
    return null;
  }
  const next = candidates.find((candidate) => pointerY < (candidate.top + candidate.bottom) / 2);
  return next ? next.pos : last.pos + last.size;
}

// Un dépôt dans ce qui est déplacé, ou à ses bords, ne changerait rien.
export function isUseful(drag: Pick<BlockDrag, 'from' | 'to'>, boundary: number | null): boolean {
  return boundary !== null && (boundary < drag.from || boundary > drag.to);
}

export const blockDragKey = new PluginKey<BlockDrag | null>('blockDrag');

function createSlot(height: number): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'block-drop-slot';
  slot.style.height = `${height}px`;
  slot.contentEditable = 'false';
  return slot;
}

function decorate(doc: ProseMirrorNode, drag: BlockDrag): DecorationSet {
  const decorations: Decoration[] = [];
  // Ce qui est déplacé reste à sa place, estompé, jusqu'au dépôt.
  doc.nodesBetween(drag.from, drag.to, (node, pos) => {
    if (pos >= drag.from && pos + node.nodeSize <= drag.to) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-dragged' }));
    }
    return false;
  });
  if (drag.target !== null) {
    // La case d'arrivée prend place entre les blocs, qui s'écartent pour elle.
    decorations.push(
      Decoration.widget(drag.target, () => createSlot(drag.slotHeight), {
        side: -1,
        key: `block-drop-slot-${drag.slotHeight}`,
      }),
    );
  }
  return DecorationSet.create(doc, decorations);
}

// État du glisser en cours, pour l'affichage : l'éditeur estompe ce qui est déplacé et
// montre la case d'arrivée. Le document n'est modifié qu'au dépôt.
export function blockDragPlugin(): Plugin<BlockDrag | null> {
  return new Plugin<BlockDrag | null>({
    key: blockDragKey,
    state: {
      init: () => null,
      apply: (transaction, current) => {
        const next = transaction.getMeta(blockDragKey) as BlockDrag | null | undefined;
        // Le document change (dépôt, saisie) : le glisser en cours n'a plus de sens.
        return next === undefined ? (transaction.docChanged ? null : current) : next;
      },
    },
    props: {
      decorations: (state: EditorState) => {
        const drag = blockDragKey.getState(state);
        return drag ? decorate(state.doc, drag) : null;
      },
    },
  });
}
