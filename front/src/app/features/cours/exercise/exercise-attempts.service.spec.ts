import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContentNode } from '../content/content-node';
import { ExerciseAttemptsService } from './exercise-attempts.service';

const ANSWER: ContentNode = { type: 'doc', content: [{ type: 'paragraph' }] };

describe('ExerciseAttemptsService', () => {
  let service: ExerciseAttemptsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExerciseAttemptsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lit le brouillon et l’historique d’un exercice', () => {
    service.progress(7, 'exercice-1').subscribe();

    expect(http.expectOne('/api/courses/7/exercises/exercice-1').request.method).toBe('GET');
  });

  it('enregistre le brouillon de la réponse', () => {
    service.saveDraft(7, 'exercice-1', ANSWER).subscribe();

    const request = http.expectOne('/api/courses/7/exercises/exercice-1/draft').request;
    expect(request.method).toBe('PUT');
    expect(request.body).toEqual({ answer: ANSWER });
  });

  it('valide la réponse à un exercice', () => {
    service.submitExercise(7, 'exercice-1', ANSWER).subscribe();

    const request = http.expectOne('/api/courses/7/exercises/exercice-1/attempts').request;
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ kind: 'exercise', answer: ANSWER });
  });

  it('enregistre le score d’un QCM', () => {
    service.submitQuiz(7, 'qcm-1', 6, 8).subscribe();

    const request = http.expectOne('/api/courses/7/exercises/qcm-1/attempts').request;
    expect(request.body).toEqual({ kind: 'quiz', score: 6, maxScore: 8 });
  });

  it('garde les cases cochées d’un QCM en cours, ou les abandonne', () => {
    service.saveQuizDraft(7, 'qcm-1', [[true, false]]).subscribe();
    service.removeDraft(7, 'qcm-1').subscribe();

    const [saved, removed] = http.match('/api/courses/7/exercises/qcm-1/draft');
    expect(saved.request.method).toBe('PUT');
    expect(saved.request.body).toEqual({ checked: [[true, false]] });
    expect(removed.request.method).toBe('DELETE');
  });

  it('lit une tentative, et la note', () => {
    service.find(4).subscribe();
    service.grade(4, 14.5).subscribe();

    const [read, graded] = http.match('/api/exercise-attempts/4');
    expect(read.request.method).toBe('GET');
    expect(graded.request.method).toBe('PATCH');
    expect(graded.request.body).toEqual({ score: 14.5 });
  });
});
