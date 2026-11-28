import { markdownToContent } from '../import/markdown-to-content.js';
import { exercisesOf, outlineOf, sectionOf } from './content-outline.js';
import { ensureHeadingIds } from './heading-ids.js';

const document = ensureHeadingIds(
  markdownToContent(`Avant-propos.

## 1. Processus

Texte.

### 1.1 **États**

Détail.

### 1.2 Fin

## 2. Ordonnancement

> [!exercice] Exercice 1 : tourniquet
>
> Énoncé.
`).document,
);
const ids = outlineOf(document).map((section) => section.id);

describe('plan d’un document', () => {
  it('liste les titres dans l’ordre, avec leur identifiant, leur niveau et leur texte sans marque', () => {
    expect(outlineOf(document)).toEqual([
      { id: ids[0], level: 2, title: '1. Processus' },
      { id: ids[1], level: 3, title: '1.1 États' },
      { id: ids[2], level: 3, title: '1.2 Fin' },
      { id: ids[3], level: 2, title: '2. Ordonnancement' },
    ]);
    expect(new Set(ids).size).toBe(4);
  });

  it('rend une section avec ses sous-sections, jusqu’au titre suivant de même niveau', () => {
    const types = (rank: number): string[] | undefined =>
      sectionOf(document, ids[rank - 1])?.map((block) => block.type);

    expect(types(1)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'paragraph',
      'heading',
    ]);
    expect(types(2)).toEqual(['heading', 'paragraph']);
    expect(types(3)).toEqual(['heading']);
    expect(types(4)).toEqual(['heading', 'exercise']);
  });

  it('ne rend rien pour un identifiant inconnu ou vide', () => {
    expect(sectionOf(document, 'inconnu0')).toBeNull();
    expect(sectionOf(document, '')).toBeNull();
  });

  it('liste les exercices avec leur clé', () => {
    expect(exercisesOf(document)).toEqual([
      { key: 'exercice-1-tourniquet', title: 'Exercice 1 : tourniquet' },
    ]);
  });
});
