import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { TermType } from '../terms/term.entity.js';
import { buildSearchQuery } from './build-search-query.js';
import {
  ExcerptSegment,
  HIGHLIGHT_START,
  HIGHLIGHT_STOP,
  parseExcerpt,
} from './parse-excerpt.js';

const GROUP_LIMIT = 20;
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_STOP}, MaxWords=30, MinWords=12, MaxFragments=1`;

export interface SearchGroup<Item> {
  // Nombre de résultats trouvés ; seuls les plus pertinents sont renvoyés.
  total: number;
  items: Item[];
}

export interface CourseResult {
  id: number;
  title: string;
  ueCode: string;
  excerpt: ExcerptSegment[];
}

export interface TermResult {
  id: number;
  label: string;
  expandedForm: string | null;
  excerpt: ExcerptSegment[];
}

export interface FileResult {
  id: number;
  name: string;
  ueCode: string;
  // Dossier qui contient le fichier ; null à la racine de l'UE.
  folderId: number | null;
  folderName: string | null;
  // Toujours vide : un fichier n'est cherché que par son nom.
  excerpt: ExcerptSegment[];
}

export interface SearchResults {
  courses: SearchGroup<CourseResult>;
  definitions: SearchGroup<TermResult>;
  acronyms: SearchGroup<TermResult>;
  files: SearchGroup<FileResult>;
}

type Row<Item> = Omit<Item, 'excerpt'> & { excerpt: string; total: string };

// Requête commune, à partir de la saisie découpée ($1 à $5, voir SearchQuery) :
// - whole : tous les mots, comparés aux racines ;
// - head et prefix : les premiers mots comparés aux racines, le dernier pris comme un
//   début de mot entier. Un mot vide (« le », « la ») ne sert jamais de début de mot ;
// - highlight : ce qui est surligné dans l'extrait, les racines trouvées et le début de mot.
const QUERY_CTE = `
  WITH query AS (
    SELECT whole, head, prefix,
           numnode(whole) > 0 AS has_whole,
           head IS NULL OR numnode(head) = 0 AS has_no_head,
           numnode(to_tsquery('french_unaccent', $3)) > 0 AS has_prefix,
           coalesce(stems || prefix, prefix) AS highlight
      FROM (
        SELECT to_tsquery('french_unaccent', $1) AS whole,
               CASE WHEN $2 = '' THEN NULL
                    ELSE to_tsquery('french_unaccent', $2) END AS head,
               to_tsquery('simple_unaccent', $4) AS prefix,
               (SELECT to_tsquery('simple', string_agg(lexeme || ':*', ' | '))
                  FROM unnest(to_tsvector('french_unaccent', $5))) AS stems
      ) parts
  )`;

// Une ligne est trouvée par tous ses mots, ou par ses premiers mots et le début du dernier.
function matches(alias: string): string {
  return `(
    (query.has_whole AND ${alias}.search_vector @@ query.whole)
    OR (query.has_prefix
        AND (query.has_no_head OR ${alias}.search_vector @@ query.head)
        AND ${alias}.search_prefix_vector @@ query.prefix)
  )`;
}

// Les lignes qui contiennent tous les mots passent avant celles trouvées par un début de mot.
function relevance(alias: string): string {
  return `CASE WHEN query.has_whole THEN ts_rank(${alias}.search_vector, query.whole) ELSE 0 END DESC,
          ts_rank(${alias}.search_prefix_vector, query.prefix) DESC`;
}

const COURSES_SQL = `${QUERY_CTE}
  SELECT course.id, course.title, ue.code AS "ueCode",
         ts_headline('simple_unaccent', course.plain_text, query.highlight, $6) AS excerpt,
         count(*) OVER () AS total
    FROM courses course
    JOIN ues ue ON ue.id = course.ue_id,
         query
   WHERE ${matches('course')}
   ORDER BY ${relevance('course')}, course.id
   LIMIT $7`;

const TERMS_SQL = `${QUERY_CTE}
  SELECT term.id, term.label, term.expanded_form AS "expandedForm",
         ts_headline('simple_unaccent', term.plain_text, query.highlight, $6) AS excerpt,
         count(*) OVER () AS total
    FROM terms term, query
   WHERE ${matches('term')} AND term.type = $8
   ORDER BY ${relevance('term')}, term.label, term.id
   LIMIT $7`;

// Un fichier n'est cherché que par son nom : pas d'extrait.
const FILES_SQL = `${QUERY_CTE}
  SELECT file.id, file.name, ue.code AS "ueCode",
         file.folder_id AS "folderId", folder.name AS "folderName",
         ''::text AS excerpt,
         count(*) OVER () AS total
    FROM files file
    JOIN ues ue ON ue.id = file.ue_id
    LEFT JOIN folders folder ON folder.id = file.folder_id,
         query
   WHERE ${matches('file')}
   ORDER BY ${relevance('file')}, file.name, file.id
   LIMIT $6`;

@Injectable()
export class SearchService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async search(input: string): Promise<SearchResults> {
    const query = buildSearchQuery(input);
    if (query === null) {
      const empty = { total: 0, items: [] };
      return {
        courses: empty,
        definitions: empty,
        acronyms: empty,
        files: empty,
      };
    }
    // Paramètres $1 à $5 de la requête commune.
    const words = [
      query.whole,
      query.head,
      query.last,
      query.prefix,
      query.text,
    ];
    const [courses, definitions, acronyms, files] = await Promise.all([
      this.run<CourseResult>(COURSES_SQL, [
        ...words,
        HEADLINE_OPTIONS,
        GROUP_LIMIT,
      ]),
      this.searchTerms(words, 'definition'),
      this.searchTerms(words, 'acronym'),
      this.run<FileResult>(FILES_SQL, [...words, GROUP_LIMIT]),
    ]);
    return { courses, definitions, acronyms, files };
  }

  private searchTerms(
    words: string[],
    type: TermType,
  ): Promise<SearchGroup<TermResult>> {
    return this.run<TermResult>(TERMS_SQL, [
      ...words,
      HEADLINE_OPTIONS,
      GROUP_LIMIT,
      type,
    ]);
  }

  private async run<Item>(
    sql: string,
    parameters: (string | number)[],
  ): Promise<SearchGroup<Item>> {
    const rows = await this.dataSource.query<Row<Item>[]>(sql, parameters);
    return {
      total: rows.length > 0 ? Number(rows[0].total) : 0,
      items: rows.map((row) => toItem<Item>(row)),
    };
  }
}

function toItem<Item>(row: Row<Item>): Item {
  const item: Record<string, unknown> = { ...row };
  delete item['total'];
  return { ...item, excerpt: parseExcerpt(row.excerpt) } as Item;
}
