import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContentNode } from './content/content-node';

export interface CourseSummary {
  id: number;
  title: string;
  position: number;
  updatedAt: string;
}

export interface Course extends CourseSummary {
  content: ContentNode;
  ue: { code: string; title: string };
}

export interface UploadedImage {
  id: number;
  src: string;
  altText: string;
}

export interface CourseInput {
  title?: string;
  content?: ContentNode;
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

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/courses/${id}`);
  }
}
