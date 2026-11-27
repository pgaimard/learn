import { markdownToContent } from '../import/markdown-to-content.js';
import { exercisesOf, outlineOf, sectionOf } from './content-outline.js';

const { document } = markdownToContent(`Avant-propos.

## 1. Processus

Texte.

### 1.1 **États**

Détail.

### 1.2 Fin

## 2. Ordonnancement

> [!exercice] Exercice 1 : tourniquet
>
> Énoncé.
`);

describe('plan d’un document', () => {
  it('numérote les titres dans l’ordre, avec leur niveau et leur texte sans marque', () => {
    expect(outlineOf(document)).toEqual([
      { rank: 1, level: 2, title: '1. Processus' },
      { rank: 2, level: 3, title: '1.1 États' },
      { rank: 3, level: 3, title: '1.2 Fin' },
      { rank: 4, level: 2, title: '2. Ordonnancement' },
    ]);
  });

  it('rend une section avec ses sous-sections, jusqu’au titre suivant de même niveau', () => {
    const types = (rank: number): string[] | undefined =>
      sectionOf(document, rank)?.map((block) => block.type);

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

  it('ne rend rien pour un rang qui n’existe pas', () => {
    expect(sectionOf(document, 0)).toBeNull();
    expect(sectionOf(document, 5)).toBeNull();
  });

  it('liste les exercices avec leur clé', () => {
    expect(exercisesOf(document)).toEqual([
      { key: 'exercice-1-tourniquet', title: 'Exercice 1 : tourniquet' },
    ]);
  });
});
