import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CoursesService } from '../courses/courses.service.js';
import { UeService } from '../ue/ue.service.js';
import {
  COURSE_DOCUMENTS,
  CourseReaderService,
  DocumentReading,
} from './course-reader.service.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

function asText(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function asMarkdown(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

// Ce qui situe la lecture, puis le Markdown tel quel : plus lisible que dans du JSON.
function asReading({ markdown, ...about }: DocumentReading): CallToolResult {
  return {
    content: [
      { type: 'text', text: JSON.stringify(about, null, 2) },
      { type: 'text', text: markdown },
    ],
  };
}

const courseId = z
  .number()
  .int()
  .positive()
  .describe('Identifiant du cours, donné par list_courses.');

// Outils que le serveur MCP offre à Claude. Chacun appelle un service de l'application :
// les règles (validation, liste blanche, verrous) sont celles de l'interface.
@Injectable()
export class McpToolsService {
  private readonly logger = new Logger(McpToolsService.name);

  constructor(
    private readonly ueService: UeService,
    private readonly coursesService: CoursesService,
    private readonly courseReader: CourseReaderService,
  ) {}

  // Un serveur par requête : le point d'entrée ne garde aucun état entre deux appels.
  createServer(): McpServer {
    const server = new McpServer({ name: 'learn', version: '1.0.0' });
    server.registerTool(
      'list_ues',
      {
        title: 'Lister les UE',
        description:
          'Liste les unités d’enseignement (UE) : code, intitulé, description et nombre de cours, de termes et de fichiers. Point de départ pour trouver un cours.',
        annotations: READ_ONLY,
      },
      () => this.run('list_ues', () => this.listUes()),
    );
    server.registerTool(
      'list_courses',
      {
        title: 'Lister les cours d’une UE',
        description:
          'Liste les cours (chapitres) d’une UE dans leur ordre : numéro, titre, nombre de sections et date de modification.',
        inputSchema: {
          ue: z.string().describe('Code de l’UE, par exemple UTC502.'),
        },
        annotations: READ_ONLY,
      },
      ({ ue }) => this.run('list_courses', () => this.listCourses(ue)),
    );
    this.registerCourseReading(server);
    return server;
  }

  private registerCourseReading(server: McpServer): void {
    server.registerTool(
      'get_course_outline',
      {
        title: 'Plan d’un cours',
        description:
          'Donne le plan d’un cours : sa révision et, pour chacun de ses trois documents (cours, fiche de révision, exercices), ses sections avec leur rang, leur niveau et leur titre. Un document absent vaut null. Pour les exercices, donne aussi la clé et le titre de chaque exercice. À appeler avant read_course_document pour ne lire que la section utile.',
        inputSchema: { course: courseId },
        annotations: READ_ONLY,
      },
      ({ course }) =>
        this.run('get_course_outline', () => this.courseReader.outline(course)),
    );
    server.registerTool(
      'read_course_document',
      {
        title: 'Lire un document d’un cours',
        description:
          'Rend en Markdown un document d’un cours, en entier ou une seule section (son titre et tout ce qui le suit jusqu’au titre suivant de même niveau, sous-sections comprises). Le premier bloc de la réponse situe la lecture : révision du cours et « losses », ce que le Markdown ne sait pas exprimer et qu’une réécriture du passage perdrait. Le second est le Markdown, au format décrit par read_content_format. Une image y garde son adresse dans l’application.',
        inputSchema: {
          course: courseId,
          document: z
            .enum(COURSE_DOCUMENTS)
            .describe(
              'Document à lire : le cours, sa fiche de révision ou ses exercices.',
            ),
          section: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              'Rang de la section, donné par get_course_outline. Absent : tout le document.',
            ),
        },
        annotations: READ_ONLY,
      },
      ({ course, document, section }) =>
        this.run(
          'read_course_document',
          () => this.courseReader.read(course, document, section),
          asReading,
        ),
    );
    server.registerTool(
      'read_content_format',
      {
        title: 'Format du contenu',
        description:
          'Rend la référence du format : le Markdown d’un cours, d’une fiche et des exercices (encadrés, diaporamas, QCM, exercices, grilles à cocher, images), et les formats termes.json et commandes.json. À lire avant de rédiger ou de corriger un contenu.',
        annotations: READ_ONLY,
      },
      () =>
        this.run(
          'read_content_format',
          () => this.courseReader.readFormat(),
          asMarkdown,
        ),
    );
  }

  private async listUes(): Promise<object[]> {
    const ues = await this.ueService.findAllWithCounts();
    return ues.map(({ code, title, description, counts }) => ({
      code,
      title,
      description,
      counts,
    }));
  }

  private async listCourses(ueCode: string): Promise<object[]> {
    const courses = await this.coursesService.findAllByUe(ueCode);
    return courses.map(({ id, title, position, sectionCount, updatedAt }) => ({
      id,
      title,
      position,
      sectionCount,
      updatedAt,
    }));
  }

  // Un refus de l'application (UE inconnue, par exemple) est rendu à Claude comme une
  // erreur d'outil, avec son message : il peut s'en servir pour se corriger.
  private async run<T>(
    tool: string,
    work: () => Promise<T>,
    present: (value: T) => CallToolResult = asText,
  ): Promise<CallToolResult> {
    this.logger.log(`Outil appelé : ${tool}`);
    try {
      return present(await work());
    } catch (error) {
      if (error instanceof HttpException) {
        return {
          isError: true,
          content: [{ type: 'text', text: error.message }],
        };
      }
      throw error;
    }
  }
}
