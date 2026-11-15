import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Command, CommandExample, CommandOption } from './command.entity.js';
import { UpdateCommandDto } from './dto/update-command.dto.js';
import { Tool, ToolVariant } from './tool.entity.js';

const UNIQUE_VIOLATION = '23505';

// Commande de même nom dans un autre outil.
export interface CommandTwin {
  commandId: number;
  toolId: number;
  toolName: string;
}

// Commande telle que l'API la rend : modes et déclinaisons par leur numéro, ceux de
// l'outil étant déjà connus de l'écran.
export interface CommandView {
  id: number;
  name: string;
  summary: string;
  syntax: string;
  modeId: number | null;
  variantIds: number[];
  notes: string;
  themes: string[];
  options: {
    id: number;
    text: string;
    description: string;
    variantIds: number[];
  }[];
  examples: { id: number; line: string; explanation: string; output: string }[];
  alsoIn: CommandTwin[];
}

@Injectable()
export class CommandsService {
  constructor(
    @InjectRepository(Command) private readonly commands: Repository<Command>,
    @InjectRepository(Tool) private readonly tools: Repository<Tool>,
  ) {}

  async findByTool(toolId: number): Promise<CommandView[]> {
    await this.findTool(toolId);
    const commands = await this.commands.find({
      where: { tool: { id: toolId } },
      relations: RELATIONS,
      order: ORDER,
    });
    const twins = await this.findTwins(toolId, commands);
    return commands
      .map((command) => toView(command, twins))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async create(toolId: number, input: UpdateCommandDto): Promise<CommandView> {
    const tool = await this.findTool(toolId);
    const command = this.commands.create({
      tool,
      mode: null,
      variants: [],
      themes: [],
      options: [],
      examples: [],
    });
    apply(command, input, tool);
    const saved = await this.save(command);
    return this.findView(toolId, saved.id);
  }

  async update(
    toolId: number,
    id: number,
    changes: UpdateCommandDto,
  ): Promise<CommandView> {
    const tool = await this.findTool(toolId);
    const command = await this.findOne(toolId, id);
    apply(command, changes, tool);
    await this.save(command);
    return this.findView(toolId, id);
  }

  async remove(toolId: number, id: number): Promise<void> {
    const command = await this.findOne(toolId, id);
    await this.commands.delete({ id: command.id });
  }

  private async findView(toolId: number, id: number): Promise<CommandView> {
    const command = await this.findOne(toolId, id);
    return toView(command, await this.findTwins(toolId, [command]));
  }

  private async findOne(toolId: number, id: number): Promise<Command> {
    const command = await this.commands.findOne({
      where: { id, tool: { id: toolId } },
      relations: RELATIONS,
      order: ORDER,
    });
    if (!command) {
      throw new NotFoundException('Cette commande n’existe pas.');
    }
    return command;
  }

  private async findTool(id: number): Promise<Tool> {
    const tool = await this.tools.findOne({
      where: { id },
      relations: { modes: true, variants: true },
    });
    if (!tool) {
      throw new NotFoundException('Cet outil n’existe pas.');
    }
    return tool;
  }

  // Commandes des autres outils qui portent le nom d'une de celles-ci, rangées par nom.
  private async findTwins(
    toolId: number,
    commands: Command[],
  ): Promise<Map<string, CommandTwin[]>> {
    const twins = new Map<string, CommandTwin[]>();
    if (commands.length === 0) {
      return twins;
    }
    const others = await this.commands
      .createQueryBuilder('command')
      .innerJoinAndSelect('command.tool', 'tool')
      .where('tool.id <> :toolId', { toolId })
      .andWhere('lower(command.name) IN (:...names)', {
        names: commands.map((command) => key(command.name)),
      })
      .orderBy('tool.name')
      .getMany();
    for (const other of others) {
      const list = twins.get(key(other.name)) ?? [];
      list.push({
        commandId: other.id,
        toolId: other.tool.id,
        toolName: other.tool.name,
      });
      twins.set(key(other.name), list);
    }
    return twins;
  }

  private async save(command: Command): Promise<Command> {
    try {
      return await this.commands.save(command);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `La commande « ${command.name} » existe déjà dans cet outil.`,
        );
      }
      throw error;
    }
  }
}

const RELATIONS = {
  mode: true,
  variants: true,
  options: { variants: true },
  examples: true,
} as const;

const ORDER = {
  options: { position: 'ASC' },
  examples: { position: 'ASC' },
} as const;

function key(name: string): string {
  return name.toLowerCase();
}

// Reporte sur la commande les champs fournis ; ceux qui manquent gardent leur valeur.
function apply(command: Command, input: UpdateCommandDto, tool: Tool): void {
  command.name = input.name ?? command.name;
  command.summary = input.summary ?? command.summary ?? '';
  command.syntax = input.syntax ?? command.syntax ?? '';
  command.notes = input.notes ?? command.notes ?? '';
  if (input.modeId !== undefined) {
    command.mode = findMode(tool, input.modeId);
  }
  if (input.variantIds !== undefined) {
    command.variants = findVariants(tool, input.variantIds);
  }
  if (input.themes !== undefined) {
    command.themes = cleanThemes(input.themes);
  }
  if (input.options !== undefined) {
    command.options = input.options.map((option, index) =>
      Object.assign(new CommandOption(), {
        text: option.text,
        description: option.description ?? '',
        variants: findVariants(tool, option.variantIds ?? []),
        position: index + 1,
      }),
    );
  }
  if (input.examples !== undefined) {
    command.examples = input.examples.map((example, index) =>
      Object.assign(new CommandExample(), {
        line: example.line,
        explanation: example.explanation ?? '',
        output: example.output ?? '',
        position: index + 1,
      }),
    );
  }
}

function findMode(tool: Tool, id: number | null): Command['mode'] {
  if (id === null) {
    return null;
  }
  const mode = tool.modes.find((candidate) => candidate.id === id);
  if (!mode) {
    throw new BadRequestException(
      `Le mode n° ${id} n’appartient pas à cet outil.`,
    );
  }
  return mode;
}

function findVariants(tool: Tool, ids: number[]): ToolVariant[] {
  return [...new Set(ids)].map((id) => {
    const variant = tool.variants.find((candidate) => candidate.id === id);
    if (!variant) {
      throw new BadRequestException(
        `La déclinaison n° ${id} n’appartient pas à cet outil.`,
      );
    }
    return variant;
  });
}

// Thèmes sans espaces autour ni doublon, la casse ne distinguant pas deux thèmes.
function cleanThemes(themes: string[]): string[] {
  const seen = new Set<string>();
  return themes
    .map((theme) => theme.trim())
    .filter((theme) => {
      const isNew = theme !== '' && !seen.has(key(theme));
      seen.add(key(theme));
      return isNew;
    });
}

function variantIds(variants: ToolVariant[]): number[] {
  return variants
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((variant) => variant.id);
}

function toView(
  command: Command,
  twins: Map<string, CommandTwin[]>,
): CommandView {
  return {
    id: command.id,
    name: command.name,
    summary: command.summary,
    syntax: command.syntax,
    modeId: command.mode?.id ?? null,
    variantIds: variantIds(command.variants),
    notes: command.notes,
    themes: command.themes,
    options: command.options.map((option) => ({
      id: option.id,
      text: option.text,
      description: option.description,
      variantIds: variantIds(option.variants),
    })),
    examples: command.examples.map(({ id, line, explanation, output }) => ({
      id,
      line,
      explanation,
      output,
    })),
    alsoIn: twins.get(key(command.name)) ?? [],
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
  );
}
