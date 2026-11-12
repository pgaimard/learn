import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { DialogService } from '../../../core/dialog/dialog.service';
import { Dropdown, DropdownOption } from '../../../core/ui/dropdown';
import { Icon } from '../../../core/ui/icon';
import { MenuButton } from '../../../core/ui/menu-button';
import { shortcut } from '../../../core/ui/platform';
import { CALLOUT_KINDS, CALLOUT_LABELS, CalloutKind } from '../content/callout';
import { editLink } from './selection/edit-link';

type BlockStyle = 'paragraph' | 'h2' | 'h3' | 'h4' | 'h5';
type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';
type Chain = ReturnType<Editor['chain']>;
type Command = (chain: Chain) => Chain;

@Component({
  selector: 'app-editor-toolbar',
  imports: [Dropdown, Icon, MenuButton],
  host: {
    role: 'toolbar',
    'aria-label': 'Mise en forme',
    // Cliquer un outil ne doit ni déplacer le curseur ni défaire la sélection du texte.
    '(mousedown)': 'keepSelection($event)',
  },
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbar {
  readonly editor = input.required<Editor>();

  private readonly dialog = inject(DialogService);

  // Image choisie par le bouton « Image » ; l'envoi est fait par la page.
  readonly imagePicked = output<File>();

  // Chaque style de titre se montre à sa taille dans la liste.
  protected readonly blockStyles: DropdownOption[] = [
    { value: 'paragraph', label: 'Paragraphe' },
    { value: 'h2', label: 'Section', look: 'large' },
    { value: 'h3', label: 'Sous-section', look: 'medium' },
    { value: 'h4', label: 'Sous-sous-section', look: 'strong' },
    { value: 'h5', label: 'Point', look: 'muted' },
  ];
  // Raccourcis rappelés dans les infobulles.
  protected readonly keys = {
    bold: shortcut('B'),
    italic: shortcut('I'),
    underline: shortcut('U'),
    undo: shortcut('Z'),
    redo: shortcut('⇧Z'),
  };
  protected readonly calloutKinds = CALLOUT_KINDS;
  protected readonly calloutLabels = CALLOUT_LABELS;

  protected readonly toggleBulletList: Command = (chain) => chain.toggleBulletList();
  protected readonly toggleOrderedList: Command = (chain) => chain.toggleOrderedList();
  protected readonly toggleBlockquote: Command = (chain) => chain.toggleBlockquote();
  protected readonly toggleCodeBlock: Command = (chain) => chain.toggleCodeBlock();
  protected readonly insertRule: Command = (chain) => chain.setHorizontalRule();
  protected readonly undo: Command = (chain) => chain.undo();
  protected readonly redo: Command = (chain) => chain.redo();
  protected readonly deleteFigure: Command = (chain) => chain.deleteNode('figure');
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

  protected isActive(name: string, attributes?: Record<string, unknown>): boolean {
    this.revision();
    return this.editor().isActive(name, attributes);
  }

  protected blockStyle(): BlockStyle {
    for (const level of [2, 3, 4, 5] as const) {
      if (this.isActive('heading', { level })) {
        return `h${level}`;
      }
    }
    return 'paragraph';
  }

  protected setBlockStyle(style: string): void {
    const chain = this.editor().chain().focus();
    if (style === 'paragraph') {
      chain.setParagraph().run();
    } else {
      chain.setHeading({ level: Number(style.slice(1)) as 2 | 3 | 4 | 5 }).run();
    }
  }

  protected keepSelection(event: Event): void {
    if (event.target instanceof Element && event.target.closest('button.tool')) {
      event.preventDefault();
    }
  }

  protected toggleMark(mark: Mark): void {
    this.editor().chain().focus().toggleMark(mark).run();
  }

  protected link(): void {
    void editLink(this.editor(), this.dialog);
  }

  protected pickImage(event: Event): void {
    const field = event.target as HTMLInputElement;
    for (const file of Array.from(field.files ?? [])) {
      this.imagePicked.emit(file);
    }
    field.value = '';
  }

  protected async editAlternativeText(): Promise<void> {
    const current: unknown = this.editor().getAttributes('figure')['alt'];
    const alt = await this.dialog.prompt({
      title: 'Texte alternatif',
      label: 'Ce que montre l’image',
      initialValue: typeof current === 'string' ? current : '',
      hint: 'Lu à la place de l’image par qui ne la voit pas.',
    });
    if (alt !== null) {
      this.editor().chain().focus().updateAttributes('figure', { alt: alt.trim() }).run();
    }
  }

  // Pose l'encadré, change son type, ou le retire si ce type est déjà actif.
  protected toggleCallout(kind: CalloutKind): void {
    const chain = this.editor().chain().focus();
    if (this.isActive('callout', { kind })) {
      chain.lift('callout').run();
    } else if (this.isActive('callout')) {
      chain.updateAttributes('callout', { kind }).run();
    } else {
      chain.wrapIn('callout', { kind }).run();
    }
  }

  protected insertTable(): void {
    this.editor().chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  protected run(command: Command): void {
    command(this.editor().chain().focus()).run();
  }
}
