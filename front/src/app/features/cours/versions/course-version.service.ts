import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Course } from '../course.service';

// Ce qui a remplacé l'état gardé : l'IA, un paquet de cours, ou une restauration.
export type VersionOrigin = 'ai' | 'package' | 'restore';

// Version précédente d'un cours : son état juste avant une écriture qui ne venait pas de
// l'éditeur.
export interface CourseVersion {
  id: number;
  origin: VersionOrigin;
  revision: number;
  title: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CourseVersionService {
  private readonly http = inject(HttpClient);

  // De la plus récente à la plus ancienne.
  list(courseId: number): Observable<CourseVersion[]> {
    return this.http.get<CourseVersion[]>(`/api/courses/${courseId}/snapshots`);
  }

  // revision : celle du cours lue avant de restaurer ; l'API refuse s'il a changé depuis.
  restore(courseId: number, versionId: number, revision: number): Observable<Course> {
    return this.http.post<Course>(`/api/courses/${courseId}/snapshots/${versionId}/restore`, {
      revision,
    });
  }
}
