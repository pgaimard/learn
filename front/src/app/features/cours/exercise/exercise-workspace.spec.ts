import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogService } from '../../../core/dialog/dialog.service';
import { ContentNode } from '../content/content-node';
import { ContentEditor } from '../editor/content-editor';
import { OpenedExercise } from './exercise';
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

describe('ExerciseWorkspace', () => {
  let fixture: ComponentFixture<ExerciseWorkspace>;
  let host: HTMLElement;
  let closed: number;
  let confirmations: boolean[];

  beforeEach(async () => {
    confirmations = [];
    // jsdom ne sait pas ouvrir une fenêtre modale.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DialogService,
          useValue: { confirm: () => Promise.resolve(confirmations.shift() ?? true) },
        },
      ],
    });
    fixture = TestBed.createComponent(ExerciseWorkspace);
    fixture.componentRef.setInput('exercise', EXERCISE);
    host = fixture.nativeElement as HTMLElement;
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.body.append(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => host.remove());

  function button(label: string): HTMLButtonElement {
    return Array.from(host.querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    ) as HTMLButtonElement;
  }

  // Signale une saisie, comme le fait l'éditeur de la réponse.
  function edit(): void {
    const editor = fixture.debugElement.query(By.directive(ContentEditor))
      .componentInstance as ContentEditor;
    editor.edited.emit();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('montre l’énoncé et garde le corrigé inaccessible avant la validation', () => {
    expect(host.querySelector('h2')?.textContent).toBe('Exercice 1');
    expect(host.textContent).toContain('Calculez la moyenne.');
    expect(host.textContent).not.toContain('La moyenne vaut 4,67.');
    expect(button('Corrigé').disabled).toBe(true);
  });

  it('à la validation, fige la réponse et affiche le corrigé à côté', async () => {
    button('Valider').click();
    await settle();

    expect(host.textContent).toContain('La moyenne vaut 4,67.');
    expect(host.querySelector('app-content-editor')).toBeNull();
    expect(button('Corrigé').getAttribute('aria-pressed')).toBe('true');

    button('Énoncé').click();
    await settle();
    expect(host.textContent).toContain('Calculez la moyenne.');

    button('Reprendre ma réponse').click();
    await settle();
    expect(host.querySelector('app-content-editor')).not.toBeNull();
    expect(button('Corrigé').disabled).toBe(true);
  });

  it('se ferme sans question tant que rien n’est saisi', async () => {
    host.querySelector<HTMLButtonElement>('[aria-label="Fermer l’exercice"]')?.click();
    await settle();

    expect(closed).toBe(1);
  });

  it('fait confirmer la fermeture quand une réponse saisie serait perdue', async () => {
    const close = host.querySelector<HTMLButtonElement>('[aria-label="Fermer l’exercice"]');
    edit();
    await settle();

    confirmations = [false];
    close?.click();
    await settle();
    expect(closed).toBe(0);

    confirmations = [true];
    close?.click();
    await settle();
    expect(closed).toBe(1);
  });

  it('se ferme sans question une fois la réponse validée', async () => {
    edit();
    button('Valider').click();
    await settle();

    confirmations = [false];
    host.querySelector<HTMLButtonElement>('[aria-label="Fermer l’exercice"]')?.click();
    await settle();

    expect(closed).toBe(1);
  });
});
