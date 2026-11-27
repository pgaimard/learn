import { Editor } from '@tiptap/core';
import { ContentNode } from '../content/content-node';
import { createCourseExtensions } from '../content/course-extensions';
import { insertExercise, newExerciseKey, openedExercise } from './exercise';

function paragraph(text: string): ContentNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

const EXERCISE: ContentNode = {
  type: 'exercise',
  attrs: { title: 'Exercice 1', key: 'exercice-1' },
  content: [
    { type: 'exerciseStatement', content: [paragraph('Calculez.')] },
    { type: 'exerciseSolution', content: [paragraph('42.')] },
  ],
};

describe('exercice', () => {
  let editor: Editor | null = null;
  let host: HTMLElement | null = null;

  function setup(
    editable: boolean,
    ...content: ContentNode[]
  ): { editor: Editor; host: HTMLElement } {
    const element = document.createElement('div');
    document.body.append(element);
    const created = new Editor({
      element,
      editable,
      extensions: createCourseExtensions(),
      content: { type: 'doc', content },
    });
    editor = created;
    host = element;
    return { editor: created, host: element };
  }

  afterEach(() => {
    editor?.destroy();
    host?.remove();
    editor = null;
    host = null;
  });

  it('donne à un nouvel exercice une clé de la forme attendue par l’API', () => {
    expect(newExerciseKey()).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
    expect(newExerciseKey()).not.toBe(newExerciseKey());
  });

  it('remplace le paragraphe vide du curseur par un exercice vide, curseur dans l’énoncé', () => {
    const { editor } = setup(true, { type: 'paragraph' });

    editor.commands.command(({ tr }) => insertExercise(tr));

    const exercise = editor.state.doc.firstChild;
    expect(exercise?.type.name).toBe('exercise');
    expect(exercise?.attrs['key']).toMatch(/^exercice-[a-f0-9]{8}$/);
    expect(exercise?.child(0).type.name).toBe('exerciseStatement');
    expect(exercise?.child(1).type.name).toBe('exerciseSolution');
    expect(editor.state.selection.$from.node(-1).type.name).toBe('exerciseStatement');
  });

  it('détache l’énoncé et le corrigé de l’exercice, chacun comme un document', () => {
    const { editor } = setup(false, EXERCISE);
    const node = editor.state.doc.firstChild;

    const opened = node ? openedExercise(node) : null;

    expect(opened).toMatchObject({ key: 'exercice-1', title: 'Exercice 1' });
    expect(opened?.statement.type).toBe('doc');
    expect(opened?.statement.content?.[0].content?.[0].text).toBe('Calculez.');
    expect(opened?.solution.content?.[0].content?.[0].text).toBe('42.');
  });

  it('en lecture, montre le titre et le bouton qui ouvre l’exercice', () => {
    const { host } = setup(false, EXERCISE);

    expect(host.querySelector('.exercise-title')?.textContent).toBe('Exercice 1');
    expect(host.querySelector('.exercise-open')?.textContent).toBe('Faire l’exercice');
  });

  it('en édition, saisir le titre ne déplace pas le curseur et garde le focus dans le champ', () => {
    const { editor, host } = setup(true, paragraph('Avant.'), EXERCISE);
    editor.commands.setTextSelection(2);
    const field = host.querySelector<HTMLInputElement>('.exercise-title-field');

    field?.focus();
    if (field) {
      field.value = 'Mémoire';
      field.dispatchEvent(new Event('input'));
    }

    expect(editor.state.doc.child(1).attrs['title']).toBe('Mémoire');
    expect(editor.state.selection.from).toBe(2);
    expect(document.activeElement).toBe(field);
  });
});
