import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContentNode } from '../content/content-node';

// Tentative validée, sans sa réponse : une ligne de l'historique.
export interface AttemptSummary {
  id: number;
  kind: 'exercise' | 'quiz';
  // Note donnée (exercice) ou nombre de bonnes réponses (QCM), sur maxScore ; null tant
  // que l'exercice n'est pas noté.
  score: number | null;
  maxScore: number | null;
  submittedAt: string;
}

export interface Attempt extends Omit<AttemptSummary, 'submittedAt'> {
  answer: ContentNode | null;
  // null : c'est le brouillon en cours.
  submittedAt: string | null;
}

export interface ExerciseProgress {
  draft: Attempt | null;
  // De la plus récente à la plus ancienne.
  attempts: AttemptSummary[];
}

// Réponses données aux exercices et aux QCM d'un cours.
@Injectable({ providedIn: 'root' })
export class ExerciseAttemptsService {
  private readonly http = inject(HttpClient);

  progress(courseId: number, key: string): Observable<ExerciseProgress> {
    return this.http.get<ExerciseProgress>(this.path(courseId, key));
  }

  saveDraft(courseId: number, key: string, answer: ContentNode): Observable<Attempt> {
    return this.http.put<Attempt>(`${this.path(courseId, key)}/draft`, { answer });
  }

  submitExercise(courseId: number, key: string, answer: ContentNode): Observable<Attempt> {
    return this.http.post<Attempt>(`${this.path(courseId, key)}/attempts`, {
      kind: 'exercise',
      answer,
    });
  }

  submitQuiz(courseId: number, key: string, score: number, maxScore: number): Observable<Attempt> {
    return this.http.post<Attempt>(`${this.path(courseId, key)}/attempts`, {
      kind: 'quiz',
      score,
      maxScore,
    });
  }

  find(id: number): Observable<Attempt> {
    return this.http.get<Attempt>(`/api/exercise-attempts/${id}`);
  }

  grade(id: number, score: number | null): Observable<Attempt> {
    return this.http.patch<Attempt>(`/api/exercise-attempts/${id}`, { score });
  }

  private path(courseId: number, key: string): string {
    return `/api/courses/${courseId}/exercises/${encodeURIComponent(key)}`;
  }
}
