import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { DialogService } from '../../../core/dialog/dialog.service';
import { buildOutline } from '../content/build-outline';
import { ContentNode } from '../content/content-node';
import { CourseContent } from '../content/course-content';
import { CourseOutline } from '../content/course-outline';
import { BlockMenu } from './blocks/block-menu';
import { CodeBlockBar } from './code/code-block-bar';
import { EditorToolbar } from './editor-toolbar';
import { editLink } from './selection/edit-link';
import { SelectionBar } from './selection/selection-bar';
import { SlashMenu } from './slash/slash-menu';
import { TableMenu } from './tables/table-menu';

// Éditeur complet : barre d'outils collante et feuille de contenu. La page qui l'utilise
// fournit ses actions (projetées au-dessus de la barre), l'enregistrement et l'envoi des images.
@Component({
  selector: 'app-content-editor',
  imports: [
    BlockMenu,
    CodeBlockBar,
    CourseContent,
    CourseOutline,
    EditorToolbar,
    SelectionBar,
    SlashMenu,
    TableMenu,
  ],
  host: {
    // Ctrl+K est pris par la recherche : le lien se pose avec Ctrl+Maj+K.
    '(keydown.control.shift.k)': 'linkFromKeyboard($event)',
    '(keydown.meta.shift.k)': 'linkFromKeyboard($event)',
  },
  templateUrl: './content-editor.html',
  styleUrl: './content-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentEditor {
  readonly content = input.required<ContentNode>();
  // Nom accessible de la zone de saisie.
  readonly label = input.required<string>();

  // Plan du chapitre à gauche de la feuille, pour un texte long et structuré.
  readonly outline = input(false);
  // Rang du bloc où placer le curseur à l'ouverture ; null pour ne pas le placer.
  readonly startBlock = input<number | null>(null);

  // Émis à chaque modification faite par l'utilisateur.
  readonly edited = output();
  // Émis pour chaque image collée, déposée ou choisie ; l'envoi est fait par la page.
  readonly imageAdded = output<File>();

  private readonly view = viewChild.required(CourseContent);
  private readonly dialog = inject(DialogService);

  // Plan tenu à jour pendant la saisie : il part du contenu reçu, puis suit l'éditeur.
  protected readonly liveOutline = linkedSignal(() => buildOutline(this.content()));

  protected onEdited(): void {
    this.liveOutline.set(buildOutline(this.view().getContent()));
    this.edited.emit();
  }

  protected linkFromKeyboard(event: Event): void {
    const editor = this.view().editor();
    if (editor) {
      event.preventDefault();
      void editLink(editor, this.dialog);
    }
  }

  getContent(): ContentNode {
    return this.view().getContent();
  }

  insertFigure(src: string, alt: string): void {
    this.view().insertFigure(src, alt);
  }
}
