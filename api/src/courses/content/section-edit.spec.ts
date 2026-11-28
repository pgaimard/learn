import { markdownToContent } from '../import/markdown-to-content.js';
import { ContentNode } from './content-node.js';
import { outlineOf } from './content-outline.js';
import { ensureHeadingIds } from './heading-ids.js';
import {
  deleteSection,
  insertSection,
  replaceSection,
  SectionEditError,
} from './section-edit.js';

function blocks(markdown: string): ContentNode[] {
  return markdownToContent(markdown).document.content ?? [];
}

function documentOf(markdown: string): ContentNode {
  return ensureHeadingIds(markdownToContent(markdown).document);
}

function titles(document: ContentNode): string[] {
  return outlineOf(document).map((section) => section.title);
}

const course = documentOf(`Avant-propos.

## 1. Processus

Texte.

### 1.1 États

Détail.

### 1.2 Fin

## 2. Ordonnancement

Suite.
`);
const [first, states, end, scheduling] = outlineOf(course).map(
  (section) => section.id,
);

describe('replaceSection', () => {
  it('remplace la section et ses sous-sections, sans toucher au reste', () => {
    const result = replaceSection(
      course,
      states,
      blocks('### 1.1 États d’un processus\n\nNouveau détail.\n\n- Prêt\n'),
    );
    const before = course.content ?? [];
    const after = result.content ?? [];

    expect(titles(result)).toEqual([
      '1. Processus',
      '1.1 États d’un processus',
      '1.2 Fin',
      '2. Ordonnancement',
    ]);
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
    expect(after.slice(-3)).toEqual(before.slice(-3));
    expect(after.slice(3, 6).map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
    ]);
  });

  it('garde l’identifiant du titre renommé, et celui d’un sous-titre inchangé', () => {
    const result = replaceSection(
      course,
      first,
      blocks('## 1. Les processus\n\n### Nouveau\n\n### 1.2 Fin\n'),
    );

    expect(outlineOf(result).slice(0, 3)).toEqual([
      { id: first, level: 2, title: '1. Les processus' },
      { id: '', level: 3, title: 'Nouveau' },
      { id: end, level: 3, title: '1.2 Fin' },
    ]);
    expect(outlineOf(result)[3].id).toBe(scheduling);
  });

  it.each([
    ['Sans titre.\n', 'commence par son titre'],
    ['## 1.1 États\n', 'niveau 3'],
    ['### 1.1 États\n\n## Autre\n', 'seconde section'],
    ['### 1.1 États\n\n### Voisine\n', 'seconde section'],
  ])('refuse « %s »', (markdown, message) => {
    expect(() => replaceSection(course, states, blocks(markdown))).toThrow(
      message,
    );
  });

  it('refuse une section inconnue', () => {
    expect(() => replaceSection(course, 'inconnue', blocks('## T\n'))).toThrow(
      SectionEditError,
    );
  });
});

describe('insertSection', () => {
  it('insère après une section et ses sous-sections, ou à la fin', () => {
    const section = blocks('## Nouvelle\n\nTexte.\n');

    expect(titles(insertSection(course, section, first))).toEqual([
      '1. Processus',
      '1.1 États',
      '1.2 Fin',
      'Nouvelle',
      '2. Ordonnancement',
    ]);
    expect(titles(insertSection(course, section)).at(-1)).toBe('Nouvelle');
  });

  it('remplace le paragraphe vide d’un document vierge', () => {
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] };

    expect(
      insertSection(empty, blocks('## Titre\n')).content?.map(
        (block) => block.type,
      ),
    ).toEqual(['heading']);
  });

  it('refuse un texte sans titre', () => {
    expect(() => insertSection(course, blocks('Texte.\n'))).toThrow(
      'commence par son titre',
    );
  });
});

describe('deleteSection', () => {
  it('supprime la section et ses sous-sections', () => {
    expect(titles(deleteSection(course, first))).toEqual(['2. Ordonnancement']);
  });

  it('laisse un paragraphe vide quand il ne reste rien', () => {
    const single = documentOf('## Seule\n\nTexte.\n');

    expect(deleteSection(single, outlineOf(single)[0].id).content).toEqual([
      { type: 'paragraph' },
    ]);
  });
});

describe('clés des exercices', () => {
  const exercises = documentOf(`## 1. Série

> [!exercice] Exercice 1 : tourniquet
>
> Énoncé.

## 2. Autre série

> [!exercice] Exercice 2
>
> Énoncé.
`);
  // L'exercice a été renommé dans l'éditeur : sa clé n'est plus celle de son titre.
  const renamed: ContentNode = {
    ...exercises,
    content: exercises.content?.map((block) =>
      block.attrs?.['key'] === 'exercice-1-tourniquet'
        ? { ...block, attrs: { ...block.attrs, title: 'Le tourniquet' } }
        : block,
    ),
  };
  const series = outlineOf(exercises)[0].id;
  const keys = (document: ContentNode): unknown[] =>
    (document.content ?? [])
      .filter((block) => block.type === 'exercise')
      .map((block) => block.attrs?.['key']);

  it('garde la clé d’un exercice dont le titre n’a pas changé', () => {
    const result = replaceSection(
      renamed,
      series,
      blocks(
        '## 1. Série\n\n> [!exercice] Le tourniquet\n>\n> Nouvel énoncé.\n',
      ),
    );

    expect(keys(result)).toEqual(['exercice-1-tourniquet', 'exercice-2']);
  });

  it('donne à un nouvel exercice une clé libre dans tout le document', () => {
    const result = insertSection(
      exercises,
      blocks('## 3. Bis\n\n> [!exercice] Exercice 2\n>\n> Autre énoncé.\n'),
    );

    expect(keys(result)).toEqual([
      'exercice-1-tourniquet',
      'exercice-2',
      'exercice-2-2',
    ]);
  });
});
