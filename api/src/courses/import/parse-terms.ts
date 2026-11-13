import type { TermType } from '../../terms/term.entity.js';
import { ContentNode, EMPTY_CONTENT } from '../content/content-node.js';
import { validateContent } from '../content/validate-content.js';
import { buildImageSource } from '../content/collect-figures.js';
import { ConvertedMarkdown, markdownToContent } from './markdown-to-content.js';
import { placeImages } from './place-images.js';

export interface ParsedTerm {
  type: TermType;
  label: string;
  expandedForm: string | null;
  // Définition ; la source de ses figures est encore le chemin dans le paquet.
  content: ContentNode;
  imagePaths: string[];
}

export interface ParsedTerms {
  terms: ParsedTerm[];
  errors: string[];
}

const MAX_TERMS = 500;
const MAX_LABEL_LENGTH = 200;
const MAX_EXPANDED_FORM_LENGTH = 300;
const MAX_DEFINITION_LENGTH = 10_000;
const KEYS = ['type', 'libelle', 'forme_developpee', 'definition'];
const TYPES: Record<string, TermType> = {
  definition: 'definition',
  acronyme: 'acronym',
};

type Definition = Pick<ParsedTerm, 'content' | 'imagePaths'>;

const NO_DEFINITION: Definition = { content: EMPTY_CONTENT, imagePaths: [] };

// La liste blanche n'accepte que l'adresse d'une image enregistrée : pour vérifier la
// définition avant l'import, chaque chemin du paquet est remplacé par une adresse fictive.
function withPlaceholders(converted: ConvertedMarkdown): ContentNode {
  const placeholder = buildImageSource('terms', 0, 0);
  return placeImages(
    converted.document,
    new Map(converted.imagePaths.map((path) => [path, placeholder])),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Texte sans espaces autour ; null si la valeur est absente, undefined si elle est invalide.
function readText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    return undefined;
  }
  return value.trim() === '' ? null : value.trim();
}

class EntryParser {
  readonly errors: string[] = [];

  constructor(private readonly position: number) {}

  parse(entry: unknown): ParsedTerm | null {
    if (!isRecord(entry)) {
      this.fail('doit être un objet.');
      return null;
    }
    for (const key of Object.keys(entry)) {
      if (!KEYS.includes(key)) {
        this.fail(`clé « ${key} » non reconnue.`);
      }
    }
    const type = TYPES[String(entry['type'])] as TermType | undefined;
    if (!type) {
      this.fail('« type » doit valoir « definition » ou « acronyme ».');
      return null;
    }
    const label = readText(entry['libelle'], MAX_LABEL_LENGTH);
    if (!label) {
      this.fail(
        `« libelle » est requis (${MAX_LABEL_LENGTH} caractères au plus).`,
      );
    }
    const expandedForm = this.readExpandedForm(type, entry['forme_developpee']);
    const definition = this.readDefinition(type, entry['definition']);
    if (!label || this.errors.length > 0) {
      return null;
    }
    return { type, label, expandedForm, ...definition };
  }

  private readExpandedForm(type: TermType, value: unknown): string | null {
    const expandedForm = readText(value, MAX_EXPANDED_FORM_LENGTH);
    if (expandedForm === undefined) {
      this.fail(
        `« forme_developpee » doit être un texte de ${MAX_EXPANDED_FORM_LENGTH} caractères au plus.`,
      );
    } else if (type === 'acronym' && expandedForm === null) {
      this.fail('« forme_developpee » est requise pour un acronyme.');
    } else if (type === 'definition' && expandedForm !== null) {
      this.fail('« forme_developpee » est réservée aux acronymes.');
    }
    return expandedForm ?? null;
  }

  private readDefinition(type: TermType, value: unknown): Definition {
    const definition = readText(value, MAX_DEFINITION_LENGTH);
    if (definition === undefined) {
      this.fail(
        `« definition » doit être un texte de ${MAX_DEFINITION_LENGTH} caractères au plus.`,
      );
      return NO_DEFINITION;
    }
    if (definition === null) {
      if (type === 'definition') {
        this.fail('« definition » est requise pour une définition.');
      }
      return NO_DEFINITION;
    }
    const converted = markdownToContent(definition, 0, this.source());
    this.errors.push(...converted.errors);
    if (converted.errors.length === 0) {
      this.errors.push(
        ...validateContent(withPlaceholders(converted)).map(
          (error) => `${this.source()} : ${error}`,
        ),
      );
    }
    return { content: converted.document, imagePaths: converted.imagePaths };
  }

  private source(): string {
    return `termes.json, entrée ${this.position}`;
  }

  private fail(message: string): void {
    this.errors.push(`${this.source()} : ${message}`);
  }
}

function parseList(json: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as unknown[]) : null;
  } catch {
    return null;
  }
}

// Lit et vérifie le fichier termes.json d'un paquet ; null quand le paquet n'en a pas.
export function parseTerms(json: string | null): ParsedTerms {
  if (json === null) {
    return { terms: [], errors: [] };
  }
  const entries = parseList(json);
  if (!entries) {
    return {
      terms: [],
      errors: ['termes.json doit contenir une liste d’entrées au format JSON.'],
    };
  }
  if (entries.length > MAX_TERMS) {
    return {
      terms: [],
      errors: [`termes.json contient plus de ${MAX_TERMS} entrées.`],
    };
  }
  const terms: ParsedTerm[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    const parser = new EntryParser(index + 1);
    const term = parser.parse(entry);
    errors.push(...parser.errors);
    if (!term) {
      return;
    }
    const key = `${term.type}:${term.label.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push(
        `termes.json, entrée ${index + 1} : « ${term.label} » figure deux fois.`,
      );
    }
    seen.add(key);
    terms.push(term);
  });
  return { terms, errors };
}
