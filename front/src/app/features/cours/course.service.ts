import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Bookmark } from './bookmark/bookmark';
import { ContentNode } from './content/content-node';

export interface CourseSummary {
  id: number;
  title: string;
  position: number;
  updatedAt: string;
  // Nombre de titres de premier niveau ; présent dans les listes de cours.
  sectionCount?: number;
  // Vrai quand un marque-page de lecture est posé ; présent dans les listes de cours.
  hasBookmark?: boolean;
}

export interface Course extends CourseSummary {
  content: ContentNode;
  ue: { code: string; title: string };
  // Fiche de révision rédigée, au même format que le cours ; null quand il n'en a pas.
  sheetContent: ContentNode | null;
  // Marque-page de lecture : le titre où l'on s'est arrêté et le rang de son bloc ; tous
  // deux null quand le cours n'en a pas.
  bookmarkTitle: string | null;
  bookmarkBlock: number | null;
}

export interface UploadedImage {
  id: number;
  src: string;
  altText: string;
}

export interface CourseInput {
  title?: string;
  content?: ContentNode;
  // Fiche de révision ; null la supprime.
  sheetContent?: ContentNode | null;
}

// Dossier de fichiers d'un cours, avec ce qu'il contient à tous les niveaux.
export interface CourseFolder {
  id: number;
  name: string;
  fileCount: number;
  folderCount: number;
}

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);

  list(ueCode: string): Observable<CourseSummary[]> {
    return this.http.get<CourseSummary[]>(`/api/ues/${encodeURIComponent(ueCode)}/courses`);
  }

  get(id: number): Observable<Course> {
    return this.http.get<Course>(`/api/courses/${id}`);
  }

  create(ueCode: string, input: CourseInput): Observable<Course> {
    return this.http.post<Course>(`/api/ues/${encodeURIComponent(ueCode)}/courses`, input);
  }

  update(id: number, changes: CourseInput): Observable<Course> {
    return this.http.patch<Course>(`/api/courses/${id}`, changes);
  }

  // Enregistre l'ordre des cours d'une UE : tous leurs numéros, dans l'ordre voulu.
  reorder(ueCode: string, ids: number[]): Observable<CourseSummary[]> {
    return this.http.put<CourseSummary[]>(`/api/ues/${encodeURIComponent(ueCode)}/courses/order`, {
      ids,
    });
  }

  uploadImage(courseId: number, file: File): Observable<UploadedImage> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadedImage>(`/api/courses/${courseId}/images`, form);
  }

  // Dossier de fichiers du cours ; null s'il n'en a pas.
  folder(id: number): Observable<CourseFolder | null> {
    return this.http.get<CourseFolder | null>(`/api/courses/${id}/folder`);
  }

  // deleteFolder : supprimer aussi le dossier de fichiers du cours et son contenu. Sans
  // cela, un dossier non vide reste dans l'UE.
  remove(id: number, deleteFolder = false): Observable<void> {
    return this.http.delete<void>(`/api/courses/${id}`, {
      params: deleteFolder ? { folder: 'delete' } : {},
    });
  }

  setBookmark(id: number, bookmark: Bookmark): Observable<Course> {
    return this.http.put<Course>(`/api/courses/${id}/bookmark`, bookmark);
  }

  removeBookmark(id: number): Observable<Course> {
    return this.http.delete<Course>(`/api/courses/${id}/bookmark`);
  }
}
