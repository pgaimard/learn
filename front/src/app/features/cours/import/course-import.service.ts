import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommandImportPreview } from '../../outils/command-import.service';
import { Course } from '../course.service';

export interface ImportedTerm {
  type: 'definition' | 'acronym';
  label: string;
}

export interface ImportPreview {
  ueCode: string;
  title: string;
  position: number;
  sectionCount: number;
  imageCount: number;
  termCount: number;
  // Images des définitions que l'import créera.
  termImageCount: number;
  // Termes que l'import créera, et ceux déjà présents : laissés tels quels, ou remplacés sur demande.
  newTerms: ImportedTerm[];
  duplicateTerms: ImportedTerm[];
  // Le paquet contient une fiche de révision (fiche.md), et le nombre de ses images.
  hasSheet: boolean;
  // Le paquet contient les exercices du chapitre (exercices.md).
  hasExercises: boolean;
  sheetImageCount: number;
  // Documents de sources/, rangés dans le dossier de fichiers du cours.
  sourceCount: number;
  // Outils et commandes de commandes.json : ceux que l'import créera, ceux déjà présents.
  commands: CommandImportPreview;
  // Chapitre de même titre déjà présent dans l'UE : l'import le remplacerait. Sa fiche de
  // révision, s'il en a une, est gardée quand le paquet n'en apporte pas.
  existingCourse: {
    id: number;
    title: string;
    hasSheet: boolean;
    hasExercises: boolean;
  } | null;
}

// Ce que l'on importe : un paquet .zip ou du Markdown collé.
export type ImportSource = { kind: 'package'; file: File } | { kind: 'markdown'; markdown: string };

@Injectable({ providedIn: 'root' })
export class CourseImportService {
  private readonly http = inject(HttpClient);

  preview(source: ImportSource): Observable<ImportPreview> {
    if (source.kind === 'markdown') {
      return this.http.post<ImportPreview>('/api/course-imports/markdown/preview', {
        markdown: source.markdown,
      });
    }
    const form = new FormData();
    form.append('file', source.file);
    return this.http.post<ImportPreview>('/api/course-imports/preview', form);
  }

  // replaceTerms et replaceCommands : remplacer aussi la définition des termes et les
  // commandes déjà présents (paquet seulement).
  import(
    source: ImportSource,
    replace: boolean,
    replaceTerms = false,
    replaceCommands = false,
  ): Observable<Course> {
    if (source.kind === 'markdown') {
      return this.http.post<Course>('/api/course-imports/markdown', {
        markdown: source.markdown,
        replace,
      });
    }
    const form = new FormData();
    form.append('file', source.file);
    form.append('replace', String(replace));
    form.append('replaceTerms', String(replaceTerms));
    form.append('replaceCommands', String(replaceCommands));
    return this.http.post<Course>('/api/course-imports', form);
  }
}
