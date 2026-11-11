import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
  // Termes que l'import créera, et ceux déjà présents qu'il laissera tels quels.
  newTerms: ImportedTerm[];
  duplicateTerms: ImportedTerm[];
  // Chapitre déjà présent à cet ordre dans l'UE : l'import le remplacerait.
  existingCourse: { id: number; title: string } | null;
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

  import(source: ImportSource, replace: boolean): Observable<Course> {
    if (source.kind === 'markdown') {
      return this.http.post<Course>('/api/course-imports/markdown', {
        markdown: source.markdown,
        replace,
      });
    }
    const form = new FormData();
    form.append('file', source.file);
    form.append('replace', String(replace));
    return this.http.post<Course>('/api/course-imports', form);
  }
}
