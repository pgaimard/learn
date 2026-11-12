import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Editor } from '@tiptap/core';
import { Dropdown, DropdownOption } from '../../../../core/ui/dropdown';
import { CODE_LANGUAGES } from '../../content/code-languages';

const COPIED_NOTICE_MS = 1500;

// En-tête du bloc de code où se trouve le curseur : langage de coloration et copie du code.
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

  // Vrai un court instant après une copie, pour le dire sur le bouton.
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    const code = this.editor().state.doc.nodeAt(this.pos())?.textContent ?? '';
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), COPIED_NOTICE_MS);
  }

  protected setLanguage(value: string): void {
    const editor = this.editor();
    editor.view.dispatch(
      editor.state.tr.setNodeAttribute(this.pos(), 'language', value === '' ? null : value),
    );
    // Le curseur retourne dans le code.
    editor.commands.focus();
  }
}
