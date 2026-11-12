import { Directive, ElementRef, inject, output } from '@angular/core';

// Signale un clic sur le fond assombri d'une fenêtre modale, en dehors de son cadre.
// Le bouton doit être enfoncé et relâché sur le fond : une sélection de texte commencée
// dans la fenêtre et terminée dehors ne compte pas.
@Directive({
  selector: 'dialog[appBackdropClick]',
  host: { '(mousedown)': 'press($event)', '(click)': 'release($event)' },
})
export class BackdropClick {
  readonly backdropClick = output();

  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;
  private pressedOutside = false;

  protected press(event: MouseEvent): void {
    this.pressedOutside = this.isOutside(event);
  }

  protected release(event: MouseEvent): void {
    if (this.pressedOutside && this.isOutside(event)) {
      this.backdropClick.emit();
    }
    this.pressedOutside = false;
  }

  // Le fond appartient à la fenêtre : un clic y a la fenêtre pour cible, hors de son cadre.
  private isOutside(event: MouseEvent): boolean {
    if (event.target !== this.dialog) {
      return false;
    }
    const frame = this.dialog.getBoundingClientRect();
    return (
      event.clientX < frame.left ||
      event.clientX > frame.right ||
      event.clientY < frame.top ||
      event.clientY > frame.bottom
    );
  }
}
