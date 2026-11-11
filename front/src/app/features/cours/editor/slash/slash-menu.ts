import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { SlashCommand } from './slash-commands';

// Liste des blocs proposés sous le « / » saisi. Le focus reste dans l'éditeur : les
// flèches et Entrée y sont interceptées, la liste ne fait que montrer le choix en cours.
@Component({
  selector: 'app-slash-menu',
  templateUrl: './slash-menu.html',
  styleUrl: './slash-menu.css',
  host: {
    role: 'listbox',
    'aria-label': 'Blocs à insérer',
    // Cliquer la liste ne doit pas sortir le curseur de l'éditeur.
    '(mousedown)': '$event.preventDefault()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlashMenu {
  readonly commands = input.required<SlashCommand[]>();
  readonly activeIndex = input.required<number>();

  readonly picked = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // La liste est plus longue que sa fenêtre : le bloc mis en avant reste visible
    // quand on la parcourt aux flèches.
    afterRenderEffect(() => {
      this.activeIndex();
      const active = this.host.nativeElement.querySelector<HTMLElement>('.is-active');
      // Absent de l'environnement de test, qui ne fait pas de mise en page.
      if (typeof active?.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}
