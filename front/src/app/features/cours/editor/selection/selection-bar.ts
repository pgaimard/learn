import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { editLink } from './edit-link';

type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

// Barre de mise en forme affichée au-dessus du texte sélectionné.
@Component({
  selector: 'app-selection-bar',
  templateUrl: './selection-bar.html',
  styleUrl: './selection-bar.css',
  host: {
    role: 'toolbar',
    'aria-label': 'Mise en forme de la sélection',
    'data-editor-bar': '',
    // Cliquer la barre ne doit ni déplacer le curseur ni défaire la sélection.
    '(mousedown)': '$event.preventDefault()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionBar {
  readonly editor = input.required<Editor>();

  private readonly dialog = inject(DialogService);
  // Incrémenté à chaque transaction de l'éditeur : force le recalcul de l'état des boutons.
  private readonly revision = signal(0);

  constructor() {
    const refresh = (): void => this.revision.update((value) => value + 1);
    let watched: Editor | undefined;
    effect(() => {
      watched?.off('transaction', refresh);
      watched = this.editor();
      watched.on('transaction', refresh);
    });
    inject(DestroyRef).onDestroy(() => watched?.off('transaction', refresh));
  }

  protected isActive(name: Mark | 'link'): boolean {
    this.revision();
    return this.editor().isActive(name);
  }

  protected toggle(mark: Mark): void {
    this.editor().chain().focus().toggleMark(mark).run();
  }

  protected link(): void {
    void editLink(this.editor(), this.dialog);
  }
}
