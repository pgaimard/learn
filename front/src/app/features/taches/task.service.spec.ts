import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let service: TaskService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TaskService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('liste les tâches, avec ou sans filtre', () => {
    service.list().subscribe();
    service.list({ done: false }).subscribe();

    http.expectOne('/api/tasks');
    http.expectOne('/api/tasks?done=false');
  });

  it('crée, modifie et supprime une tâche en signalant chaque changement', () => {
    service.create({ title: 'Réviser' }).subscribe();
    http.expectOne({ method: 'POST', url: '/api/tasks' }).flush({ id: 1 });
    service.update(1, { done: true }).subscribe();
    const update = http.expectOne({ method: 'PATCH', url: '/api/tasks/1' });
    expect(update.request.body).toEqual({ done: true });
    update.flush({ id: 1 });
    service.remove(1).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/tasks/1' }).flush(null);

    expect(service.revision()).toBe(3);
  });

  it('ne signale rien quand la modification échoue', () => {
    service.update(1, { done: true }).subscribe({ error: () => undefined });
    http.expectOne('/api/tasks/1').flush(null, { status: 404, statusText: 'Not Found' });

    expect(service.revision()).toBe(0);
  });
});
