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
import { CALLOUT_KINDS, CALLOUT_LABELS, CalloutKind } from '../content/callout';

type BlockStyle = 'paragraph' | 'h2' | 'h3' | 'h4' | 'h5';
type Chain = ReturnType<Editor['chain']>;
type Command = (chain: Chain) => Chain;

const CODE_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'css',
  'java',
  'javascript',
  'json',
  'python',
  'sql',
  'typescript',
  'xml',
  'yaml',
] as const;

@Component({
  selector: 'app-editor-toolbar',
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbar {
  readonly editor = input.required<Editor>();

  private readonly dialog = inject(DialogService);

  // Image choisie par le bouton « Image » ; l'envoi est fait par la page.
  readonly imagePicked = output<File>();

  protected readonly calloutKinds = CALLOUT_KINDS;
  protected readonly calloutLabels = CALLOUT_LABELS;

  protected readonly languages = CODE_LANGUAGES;

  protected readonly toggleBold: Command = (chain) => chain.toggleBold();
  protected readonly toggleItalic: Command = (chain) => chain.toggleItalic();
  protected readonly toggleUnderline: Command = (chain) => chain.toggleUnderline();
  protected readonly toggleStrike: Command = (chain) => chain.toggleStrike();
  protected readonly toggleCode: Command = (chain) => chain.toggleCode();
  protected readonly toggleBulletList: Command = (chain) => chain.toggleBulletList();
  protected readonly toggleOrderedList: Command = (chain) => chain.toggleOrderedList();
  protected readonly toggleBlockquote: Command = (chain) => chain.toggleBlockquote();
  protected readonly toggleCodeBlock: Command = (chain) => chain.toggleCodeBlock();
  protected readonly insertRule: Command = (chain) => chain.setHorizontalRule();
  protected readonly undo: Command = (chain) => chain.undo();
  protected readonly redo: Command = (chain) => chain.redo();
  protected readonly addRow: Command = (chain) => chain.addRowAfter();
  protected readonly deleteRow: Command = (chain) => chain.deleteRow();
  protected readonly addColumn: Command = (chain) => chain.addColumnAfter();
  protected readonly deleteColumn: Command = (chain) => chain.deleteColumn();
  protected readonly toggleHeaderRow: Command = (chain) => chain.toggleHeaderRow();
  protected readonly deleteTable: Command = (chain) => chain.deleteTable();
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

  protected setBlockStyle(event: Event): void {
    const style = (event.target as HTMLSelectElement).value as BlockStyle;
    const chain = this.editor().chain().focus();
    if (style === 'paragraph') {
      chain.setParagraph().run();
    } else {
      chain.setHeading({ level: Number(style.slice(1)) as 2 | 3 | 4 | 5 }).run();
    }
  }

  protected codeLanguage(): string {
    this.revision();
    const language: unknown = this.editor().getAttributes('codeBlock')['language'];
    return typeof language === 'string' ? language : '';
  }

  protected setCodeLanguage(event: Event): void {
    const language = (event.target as HTMLSelectElement).value;
    this.editor()
      .chain()
      .focus()
      .updateAttributes('codeBlock', { language: language === '' ? null : language })
      .run();
  }

  protected async editLink(): Promise<void> {
    const current: unknown = this.editor().getAttributes('link')['href'];
    const href = await this.dialog.prompt({
      title: 'Lien',
      label: 'Adresse du lien',
      initialValue: typeof current === 'string' ? current : 'https://',
      hint: 'Laisser vide pour retirer le lien.',
    });
    if (href === null) {
      return;
    }
    const chain = this.editor().chain().focus().extendMarkRange('link');
    if (href.trim() === '') {
      chain.unsetLink().run();
    } else {
      chain.setLink({ href: href.trim() }).run();
    }
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
