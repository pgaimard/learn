import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { TaskReminderBadge } from './task-reminder-badge';
import { Task, TaskService } from './task.service';

const MINUTE = 60_000;

function task(id: number, remindInMs: number | null): Task {
  return {
    id,
    title: `Tâche ${id}`,
    ue: null,
    dueAt: null,
    remindAt: remindInMs === null ? null : new Date(Date.now() + remindInMs).toISOString(),
    done: false,
  };
}

describe('TaskReminderBadge', () => {
  let fixture: ComponentFixture<TaskReminderBadge>;
  const service = { list: vi.fn<TaskService['list']>(), revision: signal(0) };

  function setup(): void {
    TestBed.configureTestingModule({ providers: [{ provide: TaskService, useValue: service }] });
    fixture = TestBed.createComponent(TaskReminderBadge);
    fixture.detectChanges();
  }

  function badge(): string | null {
    const element = (fixture.nativeElement as HTMLElement).querySelector('.badge');
    return element ? (element.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('compte les tâches à faire dont le rappel est arrivé', () => {
    service.list.mockReturnValue(of([task(1, -MINUTE), task(2, -MINUTE), task(3, 5 * MINUTE)]));
    setup();

    expect(service.list).toHaveBeenCalledWith({ done: false });
    expect(badge()).toBe('2 à faire maintenant');
  });

  it('ne s’affiche pas sans rappel, ni quand le chargement échoue', () => {
    service.list.mockReturnValue(of([task(1, null)]));
    setup();
    expect(badge()).toBeNull();

    service.list.mockReturnValue(throwError(() => new ApiError(0, ['Injoignable.'])));
    service.revision.update((revision) => revision + 1);
    fixture.detectChanges();
    expect(badge()).toBeNull();
  });

  it('se recharge quand une tâche change', () => {
    service.list.mockReturnValue(of([]));
    setup();

    service.list.mockReturnValue(of([task(1, -MINUTE)]));
    service.revision.update((revision) => revision + 1);
    fixture.detectChanges();

    expect(badge()).toBe('1 à faire maintenant');
  });

  it('fait apparaître un rappel qui arrive pendant que l’application est ouverte', () => {
    service.list.mockReturnValue(of([task(1, 90_000)]));
    setup();
    expect(badge()).toBeNull();

    vi.advanceTimersByTime(2 * MINUTE);
    fixture.detectChanges();

    expect(badge()).toBe('1 à faire maintenant');
  });
});
