import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { ContentNode } from '../content/content-node';
import { ContentEditor } from '../editor/content-editor';
import { OpenedExercise } from './exercise';
import {
  Attempt,
  AttemptSummary,
  ExerciseAttemptsService,
  ExerciseProgress,
} from './exercise-attempts.service';
import { ExerciseWorkspace } from './exercise-workspace';

function documentOf(text: string): ContentNode {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

const EXERCISE: OpenedExercise = {
  key: 'exercice-1',
  title: 'Exercice 1',
  statement: documentOf('Calculez la moyenne.'),
  solution: documentOf('La moyenne vaut 4,67.'),
};

const OLD: AttemptSummary = {
  id: 3,
  kind: 'exercise',
  score: 12,
  maxScore: 20,
  submittedAt: '2026-11-20T10:00:00.000Z',
};

function attempt(id: number, text: string, score: number | null = null): Attempt {
  return {
    id,
    kind: 'exercise',
    answer: documentOf(text),
    score,
    maxScore: score === null ? null : 20,
    submittedAt: '2026-11-27T09:30:00.000Z',
  };
}

describe('ExerciseWorkspace', () => {
  let fixture: ComponentFixture<ExerciseWorkspace>;
  let host: HTMLElement;
  let closed: number;
  let progress: ExerciseProgress;
  let service: {
    progress: ReturnType<typeof vi.fn>;
    saveDraft: ReturnType<typeof vi.fn>;
    submitExercise: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    grade: ReturnType<typeof vi.fn>;
  };

  // Les enregistrements s'enchaînent sur plusieurs tours : on les laisse tous aboutir.
  async function settle(): Promise<void> {
    for (let turn = 0; turn < 4; turn++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  async function setup(initial: ExerciseProgress): Promise<void> {
    progress = initial;
    service = {
      progress: vi.fn(() => of(progress)),
      saveDraft: vi.fn(() => of(attempt(9, 'brouillon'))),
      submitExercise: vi.fn(() => of(attempt(4, 'Ma réponse'))),
      find: vi.fn(() => of(attempt(3, 'Ancienne réponse', 12))),
      grade: vi.fn((_id: number, score: number | null) => of(attempt(4, 'Ma réponse', score))),
    };
    // jsdom ne sait pas ouvrir une fenêtre modale.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ExerciseAttemptsService, useValue: service }],
    });
    fixture = TestBed.createComponent(ExerciseWorkspace);
    fixture.componentRef.setInput('courseId', 7);
    fixture.componentRef.setInput('exercise', EXERCISE);
    host = fixture.nativeElement as HTMLElement;
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.body.append(host);
    await settle();
  }

  afterEach(() => host.remove());

  function button(label: string): HTMLButtonElement {
    return Array.from(host.querySelectorAll('button')).find((candidate) =>
      candidate.textContent.trim().startsWith(label),
    ) as HTMLButtonElement;
  }

  // Signale une saisie, comme le fait l'éditeur de la réponse.
  function edit(): void {
    const editor = fixture.debugElement.query(By.directive(ContentEditor))
      .componentInstance as ContentEditor;
    editor.edited.emit();
  }

  it('reprend le brouillon enregistré et garde le corrigé inaccessible', async () => {
    await setup({ draft: { ...attempt(9, 'Mon brouillon'), submittedAt: null }, attempts: [OLD] });

    expect(service.progress).toHaveBeenCalledWith(7, 'exercice-1');
    expect(host.textContent).toContain('Calculez la moyenne.');
    expect(host.querySelector('app-content-editor')?.textContent).toContain('Mon brouillon');
    expect(host.textContent).not.toContain('La moyenne vaut 4,67.');
    expect(button('Corrigé').disabled).toBe(true);
    expect(button('Historique').textContent.trim()).toBe('Historique (1)');
  });

  it('enregistre le brouillon avant de fermer, sans rien demander', async () => {
    await setup({ draft: null, attempts: [] });
    edit();

    host.querySelector<HTMLButtonElement>('[aria-label="Fermer l’exercice"]')?.click();
    await settle();

    expect(service.saveDraft).toHaveBeenCalledTimes(1);
    expect(service.saveDraft.mock.calls[0].slice(0, 2)).toEqual([7, 'exercice-1']);
    expect(closed).toBe(1);
  });

  it('ferme sans enregistrer quand rien n’a été saisi', async () => {
    await setup({ draft: null, attempts: [] });

    host.querySelector<HTMLButtonElement>('[aria-label="Fermer l’exercice"]')?.click();
    await settle();

    expect(service.saveDraft).not.toHaveBeenCalled();
    expect(closed).toBe(1);
  });

  it('à la validation, enregistre la tentative et affiche le corrigé à côté de la réponse', async () => {
    await setup({ draft: null, attempts: [] });
    progress = { draft: null, attempts: [{ ...OLD, id: 4, score: null, maxScore: null }] };

    button('Valider').click();
    await settle();

    expect(service.submitExercise).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('La moyenne vaut 4,67.');
    expect(host.textContent).toContain('Ma réponse');
    expect(host.querySelector('app-content-editor')).toBeNull();
    expect(button('Historique').textContent.trim()).toBe('Historique (1)');
  });

  it('garde la réponse dans l’éditeur quand la validation échoue', async () => {
    await setup({ draft: null, attempts: [] });
    service.submitExercise.mockReturnValue(throwError(() => new Error('réseau')));

    button('Valider').click();
    await settle();

    expect(host.querySelector('app-content-editor')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'n’a pas pu être enregistrée',
    );
  });

  it('note la tentative au demi-point, et refuse une note hors de 0 à 20', async () => {
    await setup({ draft: null, attempts: [] });
    button('Valider').click();
    await settle();
    const field = host.querySelector<HTMLInputElement>('#exercise-score');
    const grade = async (value: string): Promise<void> => {
      if (field) {
        field.value = value;
      }
      // Le navigateur refuserait lui-même une note hors limites : on passe outre pour
      // vérifier le contrôle de l'application.
      host
        .querySelector('form.grade')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    };

    await grade('25');
    expect(service.grade).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('de 0 à 20');

    await grade('14.5');
    expect(service.grade).toHaveBeenCalledWith(4, 14.5);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('rouvre une tentative de l’historique, avec son corrigé', async () => {
    await setup({ draft: null, attempts: [OLD] });

    button('Historique').click();
    await settle();
    host.querySelector<HTMLButtonElement>('.history-list button')?.click();
    await settle();

    expect(service.find).toHaveBeenCalledWith(3);
    expect(host.textContent).toContain('Ancienne réponse');
    expect(host.textContent).toContain('La moyenne vaut 4,67.');

    button('Refaire').click();
    await settle();
    // On repart de l'ancienne réponse, et le corrigé se cache de nouveau.
    expect(host.querySelector('app-content-editor')?.textContent).toContain('Ancienne réponse');
    expect(button('Corrigé').disabled).toBe(true);
  });
});
