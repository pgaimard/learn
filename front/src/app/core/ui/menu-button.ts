import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

// Bouton qui ouvre un menu d'actions. Le contenu du bouton est projeté avec l'attribut
// menuTrigger ; les actions sont des <button role="menuitem" class="menu-item">.
@Component({
  selector: 'app-menu-button',
  template: `
    <button
      #trigger
      type="button"
      aria-haspopup="menu"
      [class]="buttonClass()"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="isOpen()"
      (click)="isOpen.set(!isOpen())"
    >
      <ng-content select="[menuTrigger]" />
    </button>
    <!-- Le menu reste dans le document, masqué : son contenu projeté garde ses liaisons. -->
    <div
      class="menu"
      role="menu"
      [hidden]="!isOpen()"
      [class.align-end]="alignEnd()"
      [attr.aria-label]="label()"
    >
      <ng-content />
    </div>
  `,
  styleUrl: './menu-button.css',
  host: {
    '(document:click)': 'closeFromOutside($event)',
    // Une action choisie ferme le menu.
    '(click)': 'closeAfterChoice($event)',
    '(keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuButton {
  readonly label = input.required<string>();
  // Classes du bouton, celles de la feuille globale.
  readonly buttonClass = input('button');
  // Menu aligné sur le bord droit du bouton.
  readonly alignEnd = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly isOpen = signal(false);

  constructor() {
    afterRenderEffect(() => {
      if (this.isOpen()) {
        this.items()[0]?.focus();
      }
    });
  }

  protected close(returnFocus: boolean): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      if (returnFocus) {
        this.trigger().nativeElement.focus();
      }
    }
  }

  protected closeAfterChoice(event: Event): void {
    if (event.target instanceof Element && event.target.closest('[role="menuitem"]')) {
      this.close(false);
    }
  }

  protected closeFromOutside(event: Event): void {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.close(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = this.items();
      const current = items.findIndex((item) => item === document.activeElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length]?.focus();
    }
  }

  private items(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
    );
  }
}
