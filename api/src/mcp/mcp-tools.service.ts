import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CoursesService } from '../courses/courses.service.js';
import { UeService } from '../ue/ue.service.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

function asText(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

// Outils que le serveur MCP offre à Claude. Chacun appelle un service de l'application :
// les règles (validation, liste blanche, verrous) sont celles de l'interface.
@Injectable()
export class McpToolsService {
  private readonly logger = new Logger(McpToolsService.name);

  constructor(
    private readonly ueService: UeService,
    private readonly coursesService: CoursesService,
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
    return server;
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
  private async run(
    tool: string,
    work: () => Promise<unknown>,
  ): Promise<CallToolResult> {
    this.logger.log(`Outil appelé : ${tool}`);
    try {
      return asText(await work());
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
