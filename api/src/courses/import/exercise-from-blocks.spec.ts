import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateContent } from '../content/validate-content.js';
import { exerciseKey } from './exercise-from-blocks.js';
import { markdownToContent } from './markdown-to-content.js';

const EXERCISE = [
  '> [!exercice] Exercice 1 : ordonnancement',
  '>',
  '> On considère trois processus.',
  '>',
  '> | Processus | Durée |',
  '> |-----------|-------|',
  '> | P1        | 6     |',
  '>',
  '> **Question 1.** Donnez le temps de réponse moyen.',
  '>',
  '> > [!corrige]',
  '> > **La méthode.** Dessiner le diagramme de Gantt.',
  '> >',
  '> > | Processus | 0 | 1 |',
  '> > |-----------|---|---|',
  '> > | P1        | [x] | [ ] |',
].join('\n');

describe('exercice dans le Markdown', () => {
  it('sépare l’énoncé du corrigé imbriqué à la fin, et donne une clé tirée du titre', () => {
    const { document, errors } = markdownToContent(EXERCISE, 0);

    expect(errors).toEqual([]);
    expect(validateContent(document)).toEqual([]);
    const exercise = document.content?.[0];
    expect(exercise).toMatchObject({
      type: 'exercise',
      attrs: {
        title: 'Exercice 1 : ordonnancement',
        key: 'exercice-1-ordonnancement',
      },
    });
    const [statement, solution] = exercise?.content ?? [];
    expect(statement.type).toBe('exerciseStatement');
    expect(statement.content?.map((block) => block.type)).toEqual([
      'paragraph',
      'table',
      'paragraph',
    ]);
    expect(solution.type).toBe('exerciseSolution');
    expect(solution.content?.map((block) => block.type)).toEqual([
      'paragraph',
      'table',
    ]);
    // Le corrigé peut contenir une grille à cocher.
    expect(solution.content?.[1].attrs).toEqual({ grid: true });
  });

  it('donne un corrigé vide à l’exercice qui n’en a pas', () => {
    const { document, errors } = markdownToContent(
      '> [!exercice]\n>\n> Énoncé seul.',
      0,
    );

    expect(errors).toEqual([]);
    expect(document.content?.[0].attrs).toEqual({
      title: '',
      key: 'exercice-1',
    });
    expect(document.content?.[0].content?.[1]).toEqual({
      type: 'exerciseSolution',
      content: [{ type: 'paragraph' }],
    });
  });

  it('numérote les clés de deux exercices de même titre', () => {
    const { document } = markdownToContent(
      '> [!exercice] Exercice\n>\n> Un.\n\n> [!exercice] Exercice\n>\n> Deux.',
      0,
    );

    expect(document.content?.map((block) => block.attrs?.['key'])).toEqual([
      'exercice',
      'exercice-2',
    ]);
  });

  it('tire une clé stable du titre, sans accent ni ponctuation', () => {
    expect(exerciseKey('Exercice 3 — Mémoire paginée !', 1)).toBe(
      'exercice-3-memoire-paginee',
    );
    expect(exerciseKey('', 4)).toBe('exercice-4');
    expect(exerciseKey('é'.repeat(100), 1)).toHaveLength(64);
  });

  it.each([
    ['un exercice sans énoncé', '> [!exercice] Titre', /sans énoncé/],
    [
      'un titre dans l’énoncé',
      '> [!exercice]\n>\n> ### Question 1\n>\n> Texte.',
      /énoncé d’un exercice/,
    ],
    [
      'un corrigé qui n’est pas à la fin',
      '> [!exercice]\n>\n> > [!corrige]\n> > Réponse.\n>\n> Suite de l’énoncé.',
      /énoncé d’un exercice/,
    ],
    [
      'un corrigé hors d’un exercice',
      '> [!corrige]\n> Réponse.',
      /se place à la fin/,
    ],
    [
      'un corrigé vide',
      '> [!exercice]\n>\n> Énoncé.\n>\n> > [!corrige]',
      /corrigé vide/,
    ],
  ])('refuse %s', (_case, markdown, message) => {
    const { errors } = markdownToContent(markdown, 0);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });

  it('lit l’exemple d’exercice du contrat du paquet', () => {
    const readme = readFileSync(
      join(import.meta.dirname, '../../../../contracts/README.md'),
      'utf8',
    );
    const example =
      /```markdown\n(> \[!exercice\][\s\S]*?)```/.exec(readme)?.[1] ?? '';

    const { document, errors } = markdownToContent(example, 0);

    expect(errors).toEqual([]);
    expect(validateContent(document)).toEqual([]);
    expect(document.content?.[0].attrs?.['key']).toBe(
      'exercice-1-ordonnancement',
    );
  });
});
