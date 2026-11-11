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

export interface SearchResults {
  courses: SearchGroup<CourseResult>;
  definitions: SearchGroup<TermResult>;
  acronyms: SearchGroup<TermResult>;
}

type Row<Item> = Omit<Item, 'excerpt'> & { excerpt: string; total: string };

const COURSES_SQL = `
  SELECT course.id, course.title, ue.code AS "ueCode",
         ts_headline('french_unaccent', course.plain_text, query, $2) AS excerpt,
         count(*) OVER () AS total
    FROM courses course
    JOIN ues ue ON ue.id = course.ue_id,
         to_tsquery('french_unaccent', $1) query
   WHERE course.search_vector @@ query
   ORDER BY ts_rank(course.search_vector, query) DESC, course.id
   LIMIT $3`;

const TERMS_SQL = `
  SELECT term.id, term.label, term.expanded_form AS "expandedForm",
         ts_headline('french_unaccent', term.plain_text, query, $2) AS excerpt,
         count(*) OVER () AS total
    FROM terms term,
         to_tsquery('french_unaccent', $1) query
   WHERE term.search_vector @@ query AND term.type = $4
   ORDER BY ts_rank(term.search_vector, query) DESC, term.label, term.id
   LIMIT $3`;

@Injectable()
export class SearchService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async search(input: string): Promise<SearchResults> {
    const query = buildSearchQuery(input);
    if (query === null) {
      const empty = { total: 0, items: [] };
      return { courses: empty, definitions: empty, acronyms: empty };
    }
    const [courses, definitions, acronyms] = await Promise.all([
      this.run<CourseResult>(COURSES_SQL, query),
      this.searchTerms(query, 'definition'),
      this.searchTerms(query, 'acronym'),
    ]);
    return { courses, definitions, acronyms };
  }

  private searchTerms(
    query: string,
    type: TermType,
  ): Promise<SearchGroup<TermResult>> {
    return this.run<TermResult>(TERMS_SQL, query, type);
  }

  private async run<Item>(
    sql: string,
    query: string,
    ...extra: string[]
  ): Promise<SearchGroup<Item>> {
    const rows = await this.dataSource.query<Row<Item>[]>(sql, [
      query,
      HEADLINE_OPTIONS,
      GROUP_LIMIT,
      ...extra,
    ]);
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
