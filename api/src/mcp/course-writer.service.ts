import { BadRequestException, Injectable } from '@nestjs/common';
import { isImageSource } from '../courses/content/collect-figures.js';
import { ContentNode } from '../courses/content/content-node.js';
import {
  OutlineSection,
  outlineOf,
} from '../courses/content/content-outline.js';
import {
  deleteSection,
  insertSection,
  replaceSection,
  SectionEditError,
} from '../courses/content/section-edit.js';
import {
  CourseDocumentField,
  CoursesService,
} from '../courses/courses.service.js';
import {
  ImageRule,
  markdownToContent,
} from '../courses/import/markdown-to-content.js';
import { CourseDocument } from './course-reader.service.js';

const FIELDS: Record<CourseDocument, CourseDocumentField> = {
  cours: 'content',
  fiche: 'sheetContent',
  exercices: 'exercisesContent',
};

// Une image s'écrit par l'adresse que la lecture a donnée ; l'application vérifie
// ensuite qu'elle appartient bien au cours.
const STORED_IMAGES: ImageRule = {
  accepts: isImageSource,
  expected:
    'écrivez l’adresse d’une image du cours telle que la lecture la donne (/api/courses/<cours>/images/<numéro>)',
};

// Document visé par une écriture, et révision du cours que l'IA a lue.
export interface WriteTarget {
  course: number;
  document: CourseDocument;
  revision: number;
}

// Ce qu'une écriture rend : de quoi enchaîner sans relire le cours.
export interface WriteResult {
  course: number;
  document: CourseDocument;
  revision: number;
  sections: OutlineSection[];
}

function blocksOf(markdown: string): ContentNode[] {
  const converted = markdownToContent(markdown, 0, 'Markdown', STORED_IMAGES);
  if (converted.errors.length > 0) {
    throw new BadRequestException(converted.errors);
  }
  return converted.document.content ?? [];
}

// Écritures de l'IA sur les cours, section par section. Le Markdown est converti ici ;
// les protections (révision, verrou d'édition, instantané, liste blanche, tentatives)
// sont celles de CoursesService.writeDocument.
@Injectable()
export class CourseWriterService {
  constructor(private readonly coursesService: CoursesService) {}

  replaceSection(
    target: WriteTarget,
    section: string,
    markdown: string,
  ): Promise<WriteResult> {
    const blocks = blocksOf(markdown);
    return this.write(target, (document) =>
      replaceSection(document, section, blocks),
    );
  }

  insertSection(
    target: WriteTarget,
    markdown: string,
    after?: string,
  ): Promise<WriteResult> {
    const blocks = blocksOf(markdown);
    return this.write(target, (document) =>
      insertSection(document, blocks, after),
    );
  }

  deleteSection(target: WriteTarget, section: string): Promise<WriteResult> {
    return this.write(target, (document) => deleteSection(document, section));
  }

  private async write(
    { course, document, revision }: WriteTarget,
    edit: (content: ContentNode) => ContentNode,
  ): Promise<WriteResult> {
    const field = FIELDS[document];
    const saved = await this.coursesService.writeDocument(
      course,
      field,
      revision,
      (content) => {
        try {
          return edit(content);
        } catch (error) {
          if (error instanceof SectionEditError) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }
      },
    );
    return {
      course: saved.id,
      document,
      revision: saved.revision,
      sections: outlineOf(saved[field] as ContentNode),
    };
  }
}
