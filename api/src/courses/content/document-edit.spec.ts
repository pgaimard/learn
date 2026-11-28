import { solutionFromBlocks } from '../import/exercise-from-blocks.js';
import { markdownToContent } from '../import/markdown-to-content.js';
import { ContentNode, EMPTY_CONTENT } from './content-node.js';
import { exercisesOf, outlineOf } from './content-outline.js';
import {
  appendExercises,
  setDocument,
  setExerciseSolution,
} from './document-edit.js';
import { ensureHeadingIds } from './heading-ids.js';
import { SectionEditError } from './section-edit.js';

function blocks(markdown: string): ContentNode[] {
  return markdownToContent(markdown).document.content ?? [];
}

function documentOf(markdown: string): ContentNode {
  return ensureHeadingIds(markdownToContent(markdown).document);
}

function keys(document: ContentNode): string[] {
  return exercisesOf(document).map((exercise) => exercise.key);
}

const exercises = documentOf(`## 1. QCM

> [!qcm] Autour des processus
>
> 1. Un processus est :
>    - [x] un programme en cours d'exécution
>    - [ ] un fichier

## 2. Exercices

> [!exercice] Exercice 1 : tourniquet
>
> Énoncé.
`);

describe('setDocument', () => {
  it('pose un document vierge', () => {
    const written = setDocument(EMPTY_CONTENT, blocks('## Fiche\n\nTexte.\n'));

    expect(written.content?.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
    ]);
  });

  it('garde l’identifiant d’un titre de même texte et la clé d’un exercice de même titre', () => {
    const [quizzes, section] = outlineOf(exercises);

    const written = setDocument(
      exercises,
      blocks(
        '## 2. Exercices\n\n> [!exercice] Nouveau\n>\n> A.\n\n> [!exercice] Exercice 1 : tourniquet\n>\n> B.\n\n## 3. Annales\n',
      ),
    );

    expect(outlineOf(written).map(({ id }) => id)).toEqual([section.id, '']);
    expect(outlineOf(written)[0].id).not.toBe(quizzes.id);
    expect(keys(written)).toEqual(['nouveau', 'exercice-1-tourniquet']);
  });
});

describe('appendExercises', () => {
  it('ajoute à la fin, avec une clé libre', () => {
    const written = appendExercises(
      exercises,
      blocks(
        '> [!exercice] Exercice 1 : tourniquet\n>\n> Autre.\n\n> [!qcm] Second QCM\n>\n> 1. Vrai ?\n>    - [x] oui\n>    - [ ] non\n',
      ),
    );

    expect(keys(written)).toEqual([
      'exercice-1-tourniquet',
      'exercice-1-tourniquet-2',
    ]);
    expect(written.content?.at(-1)?.type).toBe('quiz');
    expect(written.content).toHaveLength((exercises.content?.length ?? 0) + 2);
  });

  it('ne laisse pas le paragraphe vide d’un document vierge', () => {
    const written = appendExercises(
      EMPTY_CONTENT,
      blocks('> [!exercice] Seul\n>\n> Énoncé.\n'),
    );

    expect(written.content?.map((block) => block.type)).toEqual(['exercise']);
  });

  it('refuse autre chose que des QCM et des exercices', () => {
    expect(() => appendExercises(exercises, blocks('## Titre\n'))).toThrow(
      SectionEditError,
    );
  });
});

describe('setExerciseSolution', () => {
  const solution = solutionFromBlocks(blocks('Le corrigé.\n'), () => undefined);

  it('remplace le corrigé sans toucher à l’énoncé', () => {
    const written = setExerciseSolution(
      exercises,
      'exercice-1-tourniquet',
      solution,
    );
    const exercise = written.content?.find(
      (block) => block.type === 'exercise',
    );
    const before = exercises.content?.find(
      (block) => block.type === 'exercise',
    );

    expect(exercise?.content?.map((part) => part.type)).toEqual([
      'exerciseStatement',
      'exerciseSolution',
    ]);
    expect(exercise?.content?.[0]).toEqual(before?.content?.[0]);
    expect(exercise?.content?.[1]).toEqual(solution);
    expect(exercise?.attrs).toEqual(before?.attrs);
  });

  it('refuse une clé inconnue', () => {
    expect(() => setExerciseSolution(exercises, 'inconnu', solution)).toThrow(
      'Ce cours n’a pas d’exercice « inconnu »',
    );
  });
});
