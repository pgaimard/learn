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
import {
  MarkdownReading,
  ReferenceReaderService,
  TERM_TYPE_CHOICES,
} from './reference-reader.service.js';

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

function asAboutAndMarkdown({
  about,
  markdown,
}: MarkdownReading): CallToolResult {
  return {
    content: [
      { type: 'text', text: JSON.stringify(about, null, 2) },
      { type: 'text', text: markdown },
    ],
  };
}

const toolId = z
  .number()
  .int()
  .positive()
  .describe('Identifiant de l’outil, donné par list_tools.');

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
    private readonly referenceReader: ReferenceReaderService,
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
    this.registerTermReading(server);
    this.registerToolReading(server);
    this.registerSearch(server);
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

  private registerTermReading(server: McpServer): void {
    server.registerTool(
      'list_terms',
      {
        title: 'Lister les termes d’une UE',
        description:
          'Liste les termes d’une UE (définitions et acronymes) : identifiant, type, libellé, forme développée et cours d’origine. Un terme appartient à une UE ; le même libellé peut exister dans deux UE. À consulter avant de proposer un terme, pour ne pas créer de doublon.',
        inputSchema: {
          ue: z.string().describe('Code de l’UE, par exemple UTC502.'),
          course: courseId
            .optional()
            .describe('Ne garder que les termes issus de ce cours.'),
          type: z
            .enum(TERM_TYPE_CHOICES)
            .optional()
            .describe('Ne garder que les définitions ou que les acronymes.'),
        },
        annotations: READ_ONLY,
      },
      (filters) =>
        this.run('list_terms', () => this.referenceReader.listTerms(filters)),
    );
    server.registerTool(
      'read_term',
      {
        title: 'Lire un terme',
        description:
          'Rend un terme avec les clés de termes.json (type, libelle, forme_developpee), puis sa définition en Markdown. Le premier bloc donne aussi « losses », ce qu’une réécriture de la définition perdrait.',
        inputSchema: {
          term: z
            .number()
            .int()
            .positive()
            .describe('Identifiant du terme, donné par list_terms.'),
        },
        annotations: READ_ONLY,
      },
      ({ term }) =>
        this.run(
          'read_term',
          () => this.referenceReader.readTerm(term),
          asAboutAndMarkdown,
        ),
    );
  }

  private registerToolReading(server: McpServer): void {
    server.registerTool(
      'list_tools',
      {
        title: 'Lister les outils',
        description:
          'Liste les outils dont on apprend les commandes (bash, Cisco IOS, git…) : identifiant, nom, présentation et UE où ils servent.',
        annotations: READ_ONLY,
      },
      () => this.run('list_tools', () => this.referenceReader.listTools()),
    );
    server.registerTool(
      'read_tool',
      {
        title: 'Lire un outil',
        description:
          'Rend un outil avec les clés de commandes.json (outil, presentation, modes, declinaisons), ses UE et la liste de ses commandes (identifiant, nom, description), puis sa fiche « fonctionnement » en Markdown.',
        inputSchema: { tool: toolId },
        annotations: READ_ONLY,
      },
      ({ tool }) =>
        this.run(
          'read_tool',
          () => this.referenceReader.readTool(tool),
          asAboutAndMarkdown,
        ),
    );
    server.registerTool(
      'read_commands',
      {
        title: 'Lire les commandes d’un outil',
        description:
          'Rend toutes les commandes d’un outil avec les clés de commandes.json (nom, description, syntaxe, mode, declinaisons, themes, notes, options, exemples), et les UE et les cours où chacune sert.',
        inputSchema: { tool: toolId },
        annotations: READ_ONLY,
      },
      ({ tool }) =>
        this.run('read_commands', () =>
          this.referenceReader.readCommands(tool),
        ),
    );
  }

  private registerSearch(server: McpServer): void {
    server.registerTool(
      'search',
      {
        title: 'Rechercher',
        description:
          'Recherche des mots dans toute l’application, comme la recherche de l’interface : cours, définitions, acronymes, fichiers (par leur nom), outils et commandes. Rend pour chaque groupe le nombre de résultats et les vingt plus pertinents, avec un extrait. Utile pour retrouver où une notion est traitée, ou repérer une répétition entre deux cours.',
        inputSchema: {
          query: z.string().min(1).max(100).describe('Mots à chercher.'),
        },
        annotations: READ_ONLY,
      },
      ({ query }) =>
        this.run('search', () => this.referenceReader.search(query)),
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
