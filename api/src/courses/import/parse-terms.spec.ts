import { readFileSync } from 'node:fs';
import { parseTerms } from './parse-terms.js';

const EXAMPLE = readFileSync(
  new URL('../../../../contracts/termes.example.json', import.meta.url),
  'utf8',
);

function errorsOf(...entries: unknown[]): string[] {
  return parseTerms(JSON.stringify(entries)).errors;
}

describe('parseTerms', () => {
  it('accepte un paquet sans termes.json', () => {
    expect(parseTerms(null)).toEqual({ terms: [], errors: [] });
  });

  it('lit l’exemple partagé', () => {
    const { terms, errors } = parseTerms(EXAMPLE);

    expect(errors).toEqual([]);
    expect(
      terms.map(({ type, label, expandedForm }) => [type, label, expandedForm]),
    ).toEqual([
      ['definition', 'Processus', null],
      ['acronym', 'PCB', 'Process Control Block'],
      ['acronym', 'PID', 'Process Identifier'],
      ['definition', 'Commutation de contexte', null],
    ]);
    expect(terms[0].content.content?.map((block) => block.type)).toEqual([
      'paragraph',
      'codeBlock',
      'callout',
    ]);
    expect(terms[2].content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
    expect(terms.map((term) => term.imagePaths)).toEqual([
      [],
      [],
      [],
      ['images/def-commutation-01.svg'],
    ]);
  });

  it('lit une définition riche : image, tableau et encadré', () => {
    const { content } = parseTerms(EXAMPLE).terms[3];

    expect(content.content?.map((block) => block.type)).toEqual([
      'paragraph',
      'figure',
      'table',
      'callout',
    ]);
    // La source reste le chemin du paquet : l'import la remplace par l'adresse de l'image.
    expect(content.content?.[1]).toEqual({
      type: 'figure',
      attrs: {
        src: 'images/def-commutation-01.svg',
        alt: 'Deux processus qui se partagent le processeur',
      },
      content: [{ type: 'text', text: 'Commutation entre deux processus' }],
    });
  });

  it.each(['{', '{"type":"definition"}', '"texte"'])(
    'refuse un fichier qui n’est pas une liste : %s',
    (json) => {
      expect(parseTerms(json).errors).toEqual([
        'termes.json doit contenir une liste d’entrées au format JSON.',
      ]);
    },
  );

  it('refuse plus de 500 entrées', () => {
    const entries = Array.from({ length: 501 }, (_, index) => ({
      type: 'acronyme',
      libelle: `A${index}`,
      forme_developpee: 'Forme',
    }));

    expect(parseTerms(JSON.stringify(entries)).errors).toEqual([
      'termes.json contient plus de 500 entrées.',
    ]);
  });

  it.each([
    [
      'une entrée qui n’est pas un objet',
      'texte',
      /entrée 1 : doit être un objet/,
    ],
    ['un type inconnu', { type: 'note', libelle: 'X' }, /« type » doit valoir/],
    [
      'un libellé vide',
      { type: 'definition', libelle: '  ', definition: 'Texte.' },
      /« libelle » est requis/,
    ],
    [
      'un acronyme sans forme développée',
      { type: 'acronyme', libelle: 'CPU' },
      /« forme_developpee » est requise pour un acronyme/,
    ],
    [
      'une définition avec forme développée',
      {
        type: 'definition',
        libelle: 'X',
        forme_developpee: 'Y',
        definition: 'Z',
      },
      /réservée aux acronymes/,
    ],
    [
      'une définition sans texte',
      { type: 'definition', libelle: 'X' },
      /« definition » est requise pour une définition/,
    ],
    [
      'une clé inconnue',
      {
        type: 'definition',
        libelle: 'X',
        definition: 'Z',
        formeDeveloppee: 'Y',
      },
      /clé « formeDeveloppee » non reconnue/,
    ],
    [
      'une image hors du dossier images/',
      {
        type: 'definition',
        libelle: 'X',
        definition: '![Schéma](https://exemple.fr/schema.svg)',
      },
      /termes\.json, entrée 1, ligne 1 : image « https:\/\/exemple\.fr\/schema\.svg » refusée/,
    ],
    [
      'une image au milieu d’une phrase',
      {
        type: 'definition',
        libelle: 'X',
        definition: 'Voir ![Schéma](images/fig-01.svg) ci-contre.',
      },
      /une image doit être seule dans son paragraphe/,
    ],
    [
      'un Markdown non pris en charge',
      { type: 'definition', libelle: 'X', definition: '# Titre' },
      /termes\.json, entrée 1, ligne 1 : titre de niveau 1/,
    ],
  ])('refuse %s', (_label, entry, message) => {
    const errors = errorsOf(entry);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });

  it('refuse deux entrées de même type et de même libellé', () => {
    const errors = errorsOf(
      {
        type: 'acronyme',
        libelle: 'PID',
        forme_developpee: 'Process Identifier',
      },
      { type: 'definition', libelle: 'PID', definition: 'Numéro.' },
      { type: 'acronyme', libelle: 'pid', forme_developpee: 'Autre' },
    );

    expect(errors).toEqual([
      'termes.json, entrée 3 : « pid » figure deux fois.',
    ]);
  });

  it('ne laisse pas passer de HTML dans une définition', () => {
    const { terms } = parseTerms(
      JSON.stringify([
        {
          type: 'definition',
          libelle: 'X',
          definition: '<script>alert(1)</script>',
        },
      ]),
    );

    expect(JSON.stringify(terms[0].content)).toContain(
      '"text":"<script>alert(1)</script>"',
    );
  });
});
