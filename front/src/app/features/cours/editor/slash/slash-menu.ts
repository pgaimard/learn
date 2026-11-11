import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
}
