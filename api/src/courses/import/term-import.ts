import { EntityManager } from 'typeorm';
import { Term } from '../../terms/term.entity.js';
import type { TermType } from '../../terms/term.entity.js';
import { extractPlainText } from '../content/extract-plain-text.js';
import { ParsedTerm } from './parse-terms.js';

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

// Crée les termes nouveaux, rattachés au cours importé et à son UE.
export async function insertTerms(
  manager: EntityManager,
  terms: ParsedTerm[],
  origin: { ueId: number; courseId: number },
): Promise<void> {
  for (const term of terms) {
    // Un terme créé entre l'aperçu et l'import reste tel quel, comme tout doublon.
    await manager.query(
      `INSERT INTO terms (type, label, expanded_form, content, plain_text, ue_id, course_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        term.type,
        term.label,
        term.expandedForm,
        JSON.stringify(term.content),
        extractPlainText(term.content),
        origin.ueId,
        origin.courseId,
      ],
    );
  }
}
