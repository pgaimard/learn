import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { CALLOUT_KINDS, CALLOUT_LABELS } from '../../content/callout';
import { focusMenuItem, menuItems } from '../menu-keys';
import {
  BlockTransform,
  canMoveBlock,
  canTransformBlock,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  transformBlock,
} from './block-commands';

interface TransformChoice {
  label: string;
  transform: BlockTransform;
}

const TRANSFORMS: TransformChoice[] = [
  { label: 'Paragraphe', transform: { kind: 'paragraph' } },
  { label: 'Section', transform: { kind: 'heading', level: 2 } },
  { label: 'Sous-section', transform: { kind: 'heading', level: 3 } },
  { label: 'Sous-sous-section', transform: { kind: 'heading', level: 4 } },
  { label: 'Point', transform: { kind: 'heading', level: 5 } },
  { label: 'Liste à puces', transform: { kind: 'bulletList' } },
  { label: 'Liste numérotée', transform: { kind: 'orderedList' } },
  { label: 'Citation', transform: { kind: 'blockquote' } },
  { label: 'Bloc de code', transform: { kind: 'codeBlock' } },
  ...CALLOUT_KINDS.map((kind): TransformChoice => ({
    label: `Encadré « ${CALLOUT_LABELS[kind]} »`,
    transform: { kind: 'callout', callout: kind },
  })),
];

// Menu d'un bloc, ouvert par sa poignée : le déplacer, le dupliquer, le supprimer,
// ou le transformer s'il s'agit d'un paragraphe ou d'un titre.
@Component({
  selector: 'app-block-menu',
  templateUrl: './block-menu.html',
  styleUrl: './block-menu.css',
  host: {
    role: 'menu',
    'aria-label': 'Actions sur le bloc',
    '(keydown.escape)': 'closed.emit()',
    '(keydown.arrowdown)': 'focusNext($event, 1)',
    '(keydown.arrowup)': 'focusNext($event, -1)',
    '(document:mousedown)': 'closeIfOutside($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockMenu {
  readonly editor = input.required<Editor>();
  // Position du bloc dans le document.
  readonly pos = input.required<number>();

  readonly closed = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly canMoveUp = computed(() => canMoveBlock(this.editor(), this.pos(), -1));
  protected readonly canMoveDown = computed(() => canMoveBlock(this.editor(), this.pos(), 1));
  protected readonly transforms = computed(() =>
    canTransformBlock(this.editor(), this.pos()) ? TRANSFORMS : [],
  );

  constructor() {
    afterNextRender(() => menuItems(this.host.nativeElement)[0]?.focus());
  }

  protected moveUp(): void {
    this.run(() => moveBlock(this.editor(), this.pos(), -1));
  }

  protected moveDown(): void {
    this.run(() => moveBlock(this.editor(), this.pos(), 1));
  }

  protected duplicate(): void {
    this.run(() => duplicateBlock(this.editor(), this.pos()));
  }

  protected remove(): void {
    this.run(() => deleteBlock(this.editor(), this.pos()));
  }

  protected transform(choice: TransformChoice): void {
    this.run(() => transformBlock(this.editor(), this.pos(), choice.transform));
  }

  protected focusNext(event: Event, step: -1 | 1): void {
    event.preventDefault();
    focusMenuItem(this.host.nativeElement, step);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closed.emit();
    }
  }

  private run(command: () => boolean): void {
    command();
    this.closed.emit();
    this.editor().commands.focus();
  }
}
