import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { ContentNode } from '../courses/content/content-node.js';
import {
  exercisesOf,
  OutlineExercise,
  OutlineSection,
  outlineOf,
  sectionOf,
} from '../courses/content/content-outline.js';
import { contentToMarkdown } from '../courses/content/content-to-markdown.js';
import { Course } from '../courses/course.entity.js';
import { CoursesService } from '../courses/courses.service.js';

// Les trois documents d'un cours, sous le nom que leur donne le paquet de cours.
export const COURSE_DOCUMENTS = ['cours', 'fiche', 'exercices'] as const;
export type CourseDocument = (typeof COURSE_DOCUMENTS)[number];

const MISSING: Record<CourseDocument, string> = {
  cours: 'Ce cours n’a pas de contenu.',
  fiche: 'Ce cours n’a pas de fiche de révision.',
  exercices: 'Ce cours n’a pas d’exercices.',
};

// Contrat du format, embarqué dans l'image à côté de l'application (docker/api/Dockerfile).
const FORMAT_FILE = new URL('../../../contracts/README.md', import.meta.url);

export interface DocumentOutline {
  sections: OutlineSection[];
  exercises?: OutlineExercise[];
}

export interface CourseOutline {
  id: number;
  ue: string;
  title: string;
  revision: number;
  updatedAt: Date;
  // null : le cours n'a pas ce document.
  documents: Record<CourseDocument, DocumentOutline | null>;
}

export interface DocumentReading {
  course: number;
  document: CourseDocument;
  // Titre de la section lue ; absent quand tout le document est lu.
  section?: OutlineSection;
  revision: number;
  // Ce que le Markdown ne dit pas et qu'une réécriture de ce passage perdrait.
  losses: string[];
  markdown: string;
}

function documentOf(course: Course, name: CourseDocument): ContentNode | null {
  if (name === 'cours') {
    return course.content;
  }
  return name === 'fiche' ? course.sheetContent : course.exercisesContent;
}

function outline(course: Course, name: CourseDocument): DocumentOutline | null {
  const document = documentOf(course, name);
  if (document === null) {
    return null;
  }
  return name === 'exercices'
    ? { sections: outlineOf(document), exercises: exercisesOf(document) }
    : { sections: outlineOf(document) };
}

// Lecture des cours pour le serveur MCP : leur plan, et leur contenu en Markdown du contrat.
@Injectable()
export class CourseReaderService {
  constructor(private readonly coursesService: CoursesService) {}

  async outline(courseId: number): Promise<CourseOutline> {
    const course = await this.coursesService.findById(courseId);
    return {
      id: course.id,
      ue: course.ue?.code ?? '',
      title: course.title,
      revision: course.revision,
      updatedAt: course.updatedAt,
      documents: {
        cours: outline(course, 'cours'),
        fiche: outline(course, 'fiche'),
        exercices: outline(course, 'exercices'),
      },
    };
  }

  async read(
    courseId: number,
    name: CourseDocument,
    sectionId?: string,
  ): Promise<DocumentReading> {
    const course = await this.coursesService.findById(courseId);
    const document = documentOf(course, name);
    if (document === null) {
      throw new NotFoundException(MISSING[name]);
    }
    const content =
      sectionId === undefined
        ? document.content
        : sectionOf(document, sectionId);
    if (!content) {
      throw new NotFoundException(
        `Ce document n’a pas de section « ${sectionId} ». Ses sections sont données par get_course_outline.`,
      );
    }
    return {
      course: course.id,
      document: name,
      ...(sectionId === undefined
        ? {}
        : { section: outlineOf({ type: 'doc', content })[0] }),
      revision: course.revision,
      ...contentToMarkdown({ type: 'doc', content }),
    };
  }

  readFormat(): Promise<string> {
    return readFile(FORMAT_FILE, 'utf8');
  }
}
