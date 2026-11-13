import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Term } from '../../terms/term.entity.js';
import type { TermType } from '../../terms/term.entity.js';
import { buildImageSource } from '../content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from '../content/content-node.js';
import { extractPlainText } from '../content/extract-plain-text.js';
import { validateContent } from '../content/validate-content.js';
import { ParsedTerm } from './parse-terms.js';
import { findAltText, placeImages } from './place-images.js';

export interface TermReference {
  type: TermType;
  label: string;
}

export interface SortedTerms {
  // Termes absents de l'application : l'import les crée.
  fresh: ParsedTerm[];
  // Termes déjà présents (même type, même libellé sans la casse) : l'import les laisse tels quels.
  duplicates: ParsedTerm[];
}

function keyOf(term: TermReference): string {
  return `${term.type}:${term.label.toLowerCase()}`;
}

export function toReference(term: TermReference): TermReference {
  return { type: term.type, label: term.label };
}

export async function sortTerms(
  manager: EntityManager,
  terms: ParsedTerm[],
): Promise<SortedTerms> {
  if (terms.length === 0) {
    return { fresh: [], duplicates: [] };
  }
  const existing = await manager
    .createQueryBuilder(Term, 'term')
    .select(['term.type', 'term.label'])
    .where('lower(term.label) IN (:...labels)', {
      labels: terms.map((term) => term.label.toLowerCase()),
    })
    .getMany();
  const known = new Set(existing.map(keyOf));
  return {
    fresh: terms.filter((term) => !known.has(keyOf(term))),
    duplicates: terms.filter((term) => known.has(keyOf(term))),
  };
}

// Images du paquet et enregistrement d'une image de terme ; upload renvoie son identifiant.
export interface TermImageWriter {
  files: Map<string, Buffer>;
  upload(termId: number, data: Buffer, altText: string): Promise<number>;
}

// Crée les termes nouveaux, rattachés au cours importé et à son UE, avec leurs images.
export async function insertTerms(
  manager: EntityManager,
  terms: ParsedTerm[],
  origin: { ueId: number; courseId: number },
  images: TermImageWriter,
): Promise<void> {
  for (const term of terms) {
    // Un terme créé entre l'aperçu et l'import reste tel quel, comme tout doublon.
    // La définition est écrite ensuite, une fois ses images enregistrées.
    const inserted = await manager.query<{ id: number }[]>(
      `INSERT INTO terms (type, label, expanded_form, content, plain_text, ue_id, course_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        term.type,
        term.label,
        term.expandedForm,
        JSON.stringify(EMPTY_CONTENT),
        extractPlainText(term.content),
        origin.ueId,
        origin.courseId,
      ],
    );
    if (inserted.length > 0) {
      const content = await storeImages(inserted[0].id, term, images);
      await manager.query(
        'UPDATE terms SET content = $1::jsonb WHERE id = $2',
        [JSON.stringify(content), inserted[0].id],
      );
    }
  }
}

// Enregistre les images d'une définition et renvoie celle-ci avec leurs adresses.
async function storeImages(
  termId: number,
  term: ParsedTerm,
  images: TermImageWriter,
): Promise<ContentNode> {
  const sources = new Map<string, string>();
  for (const path of term.imagePaths) {
    const data = images.files.get(path);
    if (!data) {
      throw new BadRequestException(
        `termes.json, « ${term.label} » référence « ${path} », absent du paquet.`,
      );
    }
    const imageId = await images.upload(
      termId,
      data,
      findAltText(term.content, path),
    );
    sources.set(path, buildImageSource('terms', termId, imageId));
  }
  const content = placeImages(term.content, sources);
  const errors = validateContent(content);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return content;
}
