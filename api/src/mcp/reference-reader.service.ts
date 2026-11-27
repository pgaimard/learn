import { Injectable } from '@nestjs/common';
import { contentToMarkdown } from '../courses/content/content-to-markdown.js';
import { SearchGroup, SearchService } from '../search/search.service.js';
import type { ExcerptSegment } from '../search/parse-excerpt.js';
import { TermType } from '../terms/term.entity.js';
import { TermsService } from '../terms/terms.service.js';
import { CommandsService, CommandView } from '../tools/commands.service.js';
import { Tool } from '../tools/tool.entity.js';
import { ToolsService } from '../tools/tools.service.js';

// Les termes, les outils et les commandes sont rendus avec les clés de termes.json et de
// commandes.json (contracts/README.md) : ce que l'IA lit a la forme de ce qu'elle écrira.
const TERM_TYPE_NAMES: Record<TermType, string> = {
  definition: 'definition',
  acronym: 'acronyme',
};

export const TERM_TYPE_CHOICES = ['definition', 'acronyme'] as const;
type TermTypeChoice = (typeof TERM_TYPE_CHOICES)[number];

export interface TermFilters {
  ue: string;
  course?: number;
  type?: TermTypeChoice;
}

// Lecture en Markdown : ce qui la situe, ce qu'une réécriture perdrait, puis le texte.
export interface MarkdownReading {
  about: object;
  markdown: string;
}

function excerptText(excerpt: ExcerptSegment[]): string {
  return excerpt.map((segment) => segment.text).join('');
}

function withTextExcerpts<Item extends { excerpt: ExcerptSegment[] }>(
  group: SearchGroup<Item>,
): object {
  return {
    total: group.total,
    items: group.items.map((item) => ({
      ...item,
      excerpt: excerptText(item.excerpt),
    })),
  };
}

function namesOf(
  ids: number[],
  named: { id: number; name: string }[],
): string[] {
  return named.filter((item) => ids.includes(item.id)).map((item) => item.name);
}

function commandEntry(command: CommandView, tool: Tool): object {
  return {
    id: command.id,
    nom: command.name,
    description: command.summary,
    syntaxe: command.syntax,
    mode: tool.modes.find((mode) => mode.id === command.modeId)?.name ?? null,
    declinaisons: namesOf(command.variantIds, tool.variants),
    themes: command.themes,
    notes: command.notes,
    options: command.options.map((option) => ({
      texte: option.text,
      description: option.description,
      declinaisons: namesOf(option.variantIds, tool.variants),
    })),
    exemples: command.examples.map((example) => ({
      ligne: example.line,
      explication: example.explanation,
      sortie: example.output,
    })),
    ues: command.ueCodes,
    cours: command.courses,
  };
}

// Lecture des termes, des outils, des commandes et de la recherche pour le serveur MCP.
@Injectable()
export class ReferenceReaderService {
  constructor(
    private readonly termsService: TermsService,
    private readonly toolsService: ToolsService,
    private readonly commandsService: CommandsService,
    private readonly searchService: SearchService,
  ) {}

  async listTerms({ ue, course, type }: TermFilters): Promise<object[]> {
    const terms = await this.termsService.findAll({
      ue,
      course,
      type: type === 'acronyme' ? 'acronym' : type,
    });
    return terms.map((term) => ({
      id: term.id,
      type: TERM_TYPE_NAMES[term.type],
      libelle: term.label,
      forme_developpee: term.expandedForm,
      cours: term.courseId,
    }));
  }

  async readTerm(id: number): Promise<MarkdownReading> {
    const term = await this.termsService.findById(id);
    const { markdown, losses } = contentToMarkdown(term.content);
    return {
      about: {
        id: term.id,
        ue: term.ue?.code,
        type: TERM_TYPE_NAMES[term.type],
        libelle: term.label,
        forme_developpee: term.expandedForm,
        cours: term.course ?? null,
        losses,
      },
      markdown,
    };
  }

  listTools(): Promise<object[]> {
    return this.toolsService.findAll();
  }

  async readTool(id: number): Promise<MarkdownReading> {
    const tool = await this.toolsService.findById(id);
    const commands = await this.commandsService.findByTool(id);
    const { markdown, losses } = contentToMarkdown(tool.content);
    return {
      about: {
        id: tool.id,
        outil: tool.name,
        presentation: tool.summary,
        modes: tool.modes.map((mode) => ({
          nom: mode.name,
          invite: mode.prompt,
          entree: mode.entry,
        })),
        declinaisons: tool.variants.map((variant) => variant.name),
        ues: tool.ues.map((ue) => ue.code),
        commandes: commands.map(({ id: commandId, name, summary }) => ({
          id: commandId,
          nom: name,
          description: summary,
        })),
        losses,
      },
      markdown,
    };
  }

  async readCommands(toolId: number): Promise<object[]> {
    const tool = await this.toolsService.findById(toolId);
    const commands = await this.commandsService.findByTool(toolId);
    return commands.map((command) => commandEntry(command, tool));
  }

  // Les mêmes résultats que la recherche de l'interface, l'extrait en texte seul.
  async search(query: string): Promise<object> {
    const results = await this.searchService.search(query);
    return {
      courses: withTextExcerpts(results.courses),
      definitions: withTextExcerpts(results.definitions),
      acronyms: withTextExcerpts(results.acronyms),
      files: withTextExcerpts(results.files),
      tools: withTextExcerpts(results.tools),
      commands: withTextExcerpts(results.commands),
    };
  }
}
