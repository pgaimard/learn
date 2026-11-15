import { EntityManager } from 'typeorm';
import { extractPlainText } from '../../courses/content/extract-plain-text.js';
import { Command, CommandExample, CommandOption } from '../command.entity.js';
import { buildPlainText } from '../commands.service.js';
import { Tool, ToolMode, ToolVariant } from '../tool.entity.js';
import { ParsedCommand, ParsedTool } from './parse-commands.js';

export interface CommandReference {
  tool: string;
  name: string;
}

// Ce qu'un import de commandes créera, et ce qu'il trouvera déjà en place.
export interface CommandImportPreview {
  newTools: string[];
  existingTools: string[];
  newCommands: CommandReference[];
  // Commandes déjà présentes dans leur outil : laissées telles quelles, ou remplacées
  // si on le demande.
  duplicateCommands: CommandReference[];
}

export interface CommandImportOptions {
  // Remplacer les commandes déjà présentes par celles du fichier.
  replace: boolean;
  // Cours auquel rattacher toutes les commandes du fichier (import d'un paquet de cours).
  courseId?: number;
}

function key(name: string): string {
  return name.toLowerCase();
}

function findTool(manager: EntityManager, name: string): Promise<Tool | null> {
  return manager
    .createQueryBuilder(Tool, 'tool')
    .leftJoinAndSelect('tool.modes', 'mode')
    .leftJoinAndSelect('tool.variants', 'variant')
    .where('lower(tool.name) = lower(:name)', { name })
    .getOne();
}

function findCommands(manager: EntityManager, tool: Tool): Promise<Command[]> {
  return manager.find(Command, {
    where: { tool: { id: tool.id } },
    relations: {
      mode: true,
      variants: true,
      options: { variants: true },
      examples: true,
    },
  });
}

export async function previewCommands(
  manager: EntityManager,
  tools: ParsedTool[],
): Promise<CommandImportPreview> {
  const preview: CommandImportPreview = {
    newTools: [],
    existingTools: [],
    newCommands: [],
    duplicateCommands: [],
  };
  for (const parsed of tools) {
    const tool = await findTool(manager, parsed.name);
    const present = tool
      ? (await findCommands(manager, tool)).map((command) => key(command.name))
      : [];
    (tool ? preview.existingTools : preview.newTools).push(parsed.name);
    for (const command of parsed.commands) {
      const reference = { tool: tool?.name ?? parsed.name, name: command.name };
      (present.includes(key(command.name))
        ? preview.duplicateCommands
        : preview.newCommands
      ).push(reference);
    }
  }
  return preview;
}

// Écrit les outils et les commandes du fichier. À appeler dans une transaction.
export async function importCommands(
  manager: EntityManager,
  tools: ParsedTool[],
  options: CommandImportOptions,
): Promise<void> {
  for (const parsed of tools) {
    const tool = await saveTool(manager, parsed);
    const present = await findCommands(manager, tool);
    for (const parsedCommand of parsed.commands) {
      const existing = present.find(
        (command) => key(command.name) === key(parsedCommand.name),
      );
      const command =
        existing && !options.replace
          ? existing
          : await saveCommand(manager, tool, existing, parsedCommand);
      if (options.courseId !== undefined) {
        await manager.query(
          `INSERT INTO command_courses (command_id, course_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [command.id, options.courseId],
        );
      }
    }
  }
}

// Crée l'outil s'il manque. Un outil déjà présent garde sa fiche et sa présentation :
// seuls les modes et les déclinaisons qui lui manquent sont ajoutés, à la suite.
async function saveTool(
  manager: EntityManager,
  parsed: ParsedTool,
): Promise<Tool> {
  const tool =
    (await findTool(manager, parsed.name)) ??
    manager.create(Tool, {
      name: parsed.name,
      summary: parsed.summary,
      content: parsed.content,
      plainText: extractPlainText(parsed.content),
      modes: [],
      variants: [],
    });
  for (const mode of parsed.modes) {
    if (!tool.modes.some((other) => key(other.name) === key(mode.name))) {
      tool.modes.push(
        Object.assign(new ToolMode(), mode, {
          position: nextPosition(tool.modes),
        }),
      );
    }
  }
  for (const name of parsed.variants) {
    if (!tool.variants.some((other) => key(other.name) === key(name))) {
      tool.variants.push(
        Object.assign(new ToolVariant(), {
          name,
          position: nextPosition(tool.variants),
        }),
      );
    }
  }
  return manager.save(tool);
}

function nextPosition(items: { position: number }[]): number {
  return Math.max(0, ...items.map((item) => item.position)) + 1;
}

// Crée la commande, ou remplace celle qui existe en gardant ses UE et ses cours.
async function saveCommand(
  manager: EntityManager,
  tool: Tool,
  existing: Command | undefined,
  parsed: ParsedCommand,
): Promise<Command> {
  const variants = (names: string[]): ToolVariant[] =>
    tool.variants.filter((variant) =>
      names.some((name) => key(name) === key(variant.name)),
    );
  const command = existing ?? manager.create(Command, { tool });
  Object.assign(command, {
    name: parsed.name,
    summary: parsed.summary,
    syntax: parsed.syntax,
    notes: parsed.notes,
    themes: parsed.themes,
    mode:
      tool.modes.find((mode) => key(mode.name) === key(parsed.mode ?? '')) ??
      null,
    variants: variants(parsed.variants),
    options: parsed.options.map((option, index) =>
      Object.assign(new CommandOption(), {
        text: option.text,
        description: option.description,
        variants: variants(option.variants),
        position: index + 1,
      }),
    ),
    examples: parsed.examples.map((example, index) =>
      Object.assign(new CommandExample(), example, { position: index + 1 }),
    ),
  });
  command.plainText = buildPlainText(command);
  return manager.save(command);
}
