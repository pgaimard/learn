import { BadRequestException, Injectable } from '@nestjs/common';
import {
  buildImageSource,
  isImageSource,
} from '../courses/content/collect-figures.js';
import { ContentNode } from '../courses/content/content-node.js';
import {
  exercisesOf,
  OutlineExercise,
  OutlineSection,
  outlineOf,
} from '../courses/content/content-outline.js';
import {
  appendExercises,
  setDocument,
  setExerciseSolution,
} from '../courses/content/document-edit.js';
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
import { solutionFromBlocks } from '../courses/import/exercise-from-blocks.js';
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
  // Pour les exercices : la clé de chacun, à laquelle ses tentatives sont rattachées.
  exercises?: OutlineExercise[];
}

// Les documents qui se posent en entier ; le texte du cours se modifie par section.
export const WHOLE_DOCUMENTS = ['fiche', 'exercices'] as const;
export type WholeDocument = (typeof WHOLE_DOCUMENTS)[number];

// Image envoyée : l'adresse à écrire dans le Markdown, et la ligne toute faite.
export interface UploadedImage {
  course: number;
  src: string;
  markdown: string;
}

const SVG_START =
  /^(\s|<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)*<svg[\s>]/i;

export interface CreatedCourse {
  course: number;
  ue: string;
  title: string;
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

function solutionOf(markdown: string): ContentNode {
  const errors: string[] = [];
  const solution = solutionFromBlocks(blocksOf(markdown), (message) =>
    errors.push(`Corrigé : ${message}`),
  );
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return solution;
}

// Écritures de l'IA sur les cours. Le Markdown est converti ici ;
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

  // Crée un cours à la suite de ceux de l'UE. Il n'a pas d'état d'avant à garder.
  async createCourse(
    ue: string,
    title: string,
    markdown?: string,
  ): Promise<CreatedCourse> {
    const content =
      markdown === undefined
        ? undefined
        : { type: 'doc', content: blocksOf(markdown) };
    const created = await this.coursesService.create(ue, { title, content });
    return {
      course: created.id,
      ue,
      title: created.title,
      revision: created.revision,
      sections: outlineOf(created.content),
    };
  }

  // Enregistre un schéma SVG, assaini comme toute image envoyée, et rend son adresse.
  async uploadImage(
    course: number,
    svg: string,
    alt: string,
  ): Promise<UploadedImage> {
    if (!SVG_START.test(svg)) {
      throw new BadRequestException(
        'Le texte envoyé n’est pas un SVG : il doit commencer par la balise <svg>.',
      );
    }
    const image = await this.coursesService.addImage(
      course,
      Buffer.from(svg, 'utf8'),
      alt,
    );
    const src = buildImageSource('courses', course, image.id);
    return { course, src, markdown: `![${alt}](${src})` };
  }

  // Pose la fiche ou les exercices en entier, que le cours en ait déjà ou non.
  setDocument(
    target: WriteTarget & { document: WholeDocument },
    markdown: string,
  ): Promise<WriteResult> {
    const blocks = blocksOf(markdown);
    return this.write(
      target,
      (document) => setDocument(document, blocks),
      'create',
    );
  }

  addExercises(
    target: Omit<WriteTarget, 'document'>,
    markdown: string,
  ): Promise<WriteResult> {
    const blocks = blocksOf(markdown);
    return this.write(
      { ...target, document: 'exercices' },
      (document) => appendExercises(document, blocks),
      'create',
    );
  }

  setExerciseSolution(
    target: Omit<WriteTarget, 'document'>,
    exercise: string,
    markdown: string,
  ): Promise<WriteResult> {
    const solution = solutionOf(markdown);
    return this.write({ ...target, document: 'exercices' }, (document) =>
      setExerciseSolution(document, exercise, solution),
    );
  }

  private async write(
    { course, document, revision }: WriteTarget,
    edit: (content: ContentNode) => ContentNode,
    missing: 'refuse' | 'create' = 'refuse',
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
      missing,
    );
    const written = saved[field] as ContentNode;
    return {
      course: saved.id,
      document,
      revision: saved.revision,
      sections: outlineOf(written),
      ...(document === 'exercices' ? { exercises: exercisesOf(written) } : {}),
    };
  }
}
