import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { focusMenuItem, menuItems } from '../menu-keys';
import { canMoveCurrent, moveCurrent, TableAxis } from './table-commands';

type Chain = ReturnType<Editor['chain']>;

// Menu d'un tableau, ouvert par un clic droit dans une cellule : il agit sur la ligne
// et la colonne du curseur.
@Component({
  selector: 'app-table-menu',
  templateUrl: './table-menu.html',
  styleUrl: './table-menu.css',
  host: {
    role: 'menu',
    'aria-label': 'Actions sur le tableau',
    '(keydown.escape)': 'close()',
    '(keydown.arrowdown)': 'focusNext($event, 1)',
    '(keydown.arrowup)': 'focusNext($event, -1)',
    '(document:mousedown)': 'closeIfOutside($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableMenu {
  readonly editor = input.required<Editor>();

  readonly closed = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly addRowBefore = (chain: Chain): Chain => chain.addRowBefore();
  protected readonly addRowAfter = (chain: Chain): Chain => chain.addRowAfter();
  protected readonly addColumnBefore = (chain: Chain): Chain => chain.addColumnBefore();
  protected readonly addColumnAfter = (chain: Chain): Chain => chain.addColumnAfter();
  protected readonly deleteRow = (chain: Chain): Chain => chain.deleteRow();
  protected readonly deleteColumn = (chain: Chain): Chain => chain.deleteColumn();
  protected readonly toggleHeaderRow = (chain: Chain): Chain => chain.toggleHeaderRow();
  protected readonly deleteTable = (chain: Chain): Chain => chain.deleteTable();

  constructor() {
    afterNextRender(() => menuItems(this.host.nativeElement)[0]?.focus());
  }

  protected canMove(axis: TableAxis, step: -1 | 1): boolean {
    return canMoveCurrent(this.editor().state, axis, step);
  }

  protected run(command: (chain: Chain) => Chain): void {
    command(this.editor().chain().focus()).run();
    this.closed.emit();
  }

  protected move(axis: TableAxis, step: -1 | 1): void {
    moveCurrent(this.editor(), axis, step);
    this.close();
  }

  protected close(): void {
    this.closed.emit();
    this.editor().commands.focus();
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
}
