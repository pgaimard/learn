import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { ContentNode } from '../content/content-node';
import { CourseContent } from '../content/course-content';
import { EditorToolbar } from './editor-toolbar';

// Éditeur complet : barre d'outils collante et feuille de contenu. La page qui l'utilise
// fournit ses actions (projetées au-dessus de la barre), l'enregistrement et l'envoi des images.
@Component({
  selector: 'app-content-editor',
  imports: [CourseContent, EditorToolbar],
  templateUrl: './content-editor.html',
  styleUrl: './content-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentEditor {
  readonly content = input.required<ContentNode>();
  // Nom accessible de la zone de saisie.
  readonly label = input.required<string>();

  // Émis à chaque modification faite par l'utilisateur.
  readonly edited = output();
  // Émis pour chaque image collée, déposée ou choisie ; l'envoi est fait par la page.
  readonly imageAdded = output<File>();

  private readonly view = viewChild.required(CourseContent);

  getContent(): ContentNode {
    return this.view().getContent();
  }

  insertFigure(src: string, alt: string): void {
    this.view().insertFigure(src, alt);
  }
}
