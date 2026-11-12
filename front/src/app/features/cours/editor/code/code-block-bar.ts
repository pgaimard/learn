import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Editor } from '@tiptap/core';
import { Dropdown, DropdownOption } from '../../../../core/ui/dropdown';
import { CODE_LANGUAGES } from '../../content/code-languages';

// Barre flottante affichée au-dessus du bloc de code où se trouve le curseur :
// elle porte le choix du langage de coloration.
@Component({
  selector: 'app-code-block-bar',
  imports: [Dropdown],
  templateUrl: './code-block-bar.html',
  styleUrl: './code-block-bar.css',
  host: {
    role: 'toolbar',
    'aria-label': 'Bloc de code',
    // Repère pour l'éditeur : le focus qui vient ici ne ferme pas la barre.
    'data-editor-bar': '',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeBlockBar {
  readonly editor = input.required<Editor>();
  // Position du bloc de code dans le document.
  readonly pos = input.required<number>();

  protected readonly languages: DropdownOption[] = [
    { value: '', label: 'Détection automatique' },
    ...CODE_LANGUAGES.map((name) => ({ value: name, label: name })),
  ];
  protected readonly language = computed(() => {
    const language: unknown = this.editor().state.doc.nodeAt(this.pos())?.attrs['language'];
    return typeof language === 'string' ? language : '';
  });

  protected setLanguage(value: string): void {
    const editor = this.editor();
    editor.view.dispatch(
      editor.state.tr.setNodeAttribute(this.pos(), 'language', value === '' ? null : value),
    );
    // Le curseur retourne dans le code.
    editor.commands.focus();
  }
}
