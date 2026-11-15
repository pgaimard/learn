import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';
import { Command, CommandExample, CommandOption } from './command.entity.js';
import { UpdateCommandDto } from './dto/update-command.dto.js';
import { Tool, ToolMode, ToolVariant } from './tool.entity.js';

const UNIQUE_VIOLATION = '23505';

// Commande de même nom dans un autre outil.
export interface CommandTwin {
  commandId: number;
  toolId: number;
  toolName: string;
}

// Cours où une commande sert.
export interface CommandCourse {
  id: number;
  title: string;
  ueCode: string;
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
  ueCodes: string[];
  courses: CommandCourse[];
  options: {
    id: number;
    text: string;
    description: string;
    variantIds: number[];
  }[];
  examples: { id: number; line: string; explanation: string; output: string }[];
  alsoIn: CommandTwin[];
}

// Commandes d'une UE ou d'un cours, rangées sous leur outil : de quoi afficher leurs
// fiches sans autre appel.
export interface CommandGroup {
  tool: Pick<Tool, 'id' | 'name'> & {
    modes: Pick<ToolMode, 'id' | 'name' | 'prompt' | 'entry'>[];
    variants: Pick<ToolVariant, 'id' | 'name'>[];
  };
  commands: CommandView[];
}

interface CourseRow extends CommandCourse {
  commandId: number;
}

@Injectable()
export class CommandsService {
  constructor(
    @InjectRepository(Command) private readonly commands: Repository<Command>,
    @InjectRepository(Tool) private readonly tools: Repository<Tool>,
    @InjectRepository(Ue) private readonly ues: Repository<Ue>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {}

  async findByTool(toolId: number): Promise<CommandView[]> {
    await this.findTool(toolId);
    const commands = await this.commands.find({
      where: { tool: { id: toolId } },
      relations: RELATIONS,
      order: ORDER,
    });
    return this.toViews(toolId, commands);
  }

  // Commandes étiquetées avec l'UE, ou avec un de ses cours.
  async findByUe(code: string): Promise<CommandGroup[]> {
    const ue = await this.ues.findOneBy({ code: code.trim().toUpperCase() });
    if (!ue) {
      throw new NotFoundException('Cette UE n’existe pas.');
    }
    const rows = await this.commands.query<{ id: number }[]>(
      `SELECT command_id AS id FROM command_ues WHERE ue_id = $1
       UNION
       SELECT link.command_id FROM command_courses link
         JOIN courses course ON course.id = link.course_id
        WHERE course.ue_id = $1`,
      [ue.id],
    );
    return this.findGroups(rows.map((row) => row.id));
  }

  async findByCourse(courseId: number): Promise<CommandGroup[]> {
    if (!(await this.courses.existsBy({ id: courseId }))) {
      throw new NotFoundException('Ce cours n’existe pas.');
    }
    const rows = await this.commands.query<{ id: number }[]>(
      'SELECT command_id AS id FROM command_courses WHERE course_id = $1',
      [courseId],
    );
    return this.findGroups(rows.map((row) => row.id));
  }

  async create(toolId: number, input: UpdateCommandDto): Promise<CommandView> {
    const tool = await this.findTool(toolId);
    const command = this.commands.create({
      tool,
      mode: null,
      variants: [],
      themes: [],
      ues: [],
      options: [],
      examples: [],
    });
    await this.apply(command, input, tool);
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
    await this.apply(command, changes, tool);
    await this.save(command);
    return this.findView(toolId, id);
  }

  async remove(toolId: number, id: number): Promise<void> {
    const command = await this.findOne(toolId, id);
    await this.commands.delete({ id: command.id });
  }

  private async findView(toolId: number, id: number): Promise<CommandView> {
    const [view] = await this.toViews(toolId, [await this.findOne(toolId, id)]);
    return view;
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

  // Range les commandes portant ces numéros sous leur outil, par nom d'outil.
  private async findGroups(ids: number[]): Promise<CommandGroup[]> {
    if (ids.length === 0) {
      return [];
    }
    const commands = await this.commands.find({
      where: { id: In(ids) },
      relations: {
        ...RELATIONS,
        tool: { modes: true, variants: true },
      },
      order: {
        ...ORDER,
        tool: { modes: { position: 'ASC' }, variants: { position: 'ASC' } },
      },
    });
    const tools = new Map(
      commands.map((command) => [command.tool.id, command.tool]),
    );
    const groups = await Promise.all(
      [...tools.values()].map(async (tool) => ({
        tool: {
          id: tool.id,
          name: tool.name,
          modes: tool.modes.map(({ id, name, prompt, entry }) => ({
            id,
            name,
            prompt,
            entry,
          })),
          variants: tool.variants.map(({ id, name }) => ({ id, name })),
        },
        commands: await this.toViews(
          tool.id,
          commands.filter((command) => command.tool.id === tool.id),
        ),
      })),
    );
    return groups.sort((a, b) => a.tool.name.localeCompare(b.tool.name, 'fr'));
  }

  // Commandes d'un même outil, prêtes à rendre, par ordre alphabétique.
  private async toViews(
    toolId: number,
    commands: Command[],
  ): Promise<CommandView[]> {
    const [twins, courses] = await Promise.all([
      this.findTwins(toolId, commands),
      this.findCourses(commands),
    ]);
    return commands
      .map((command) => toView(command, twins, courses))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
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

  // Cours où servent ces commandes, rangés par commande, dans l'ordre des UE et des cours.
  private async findCourses(
    commands: Command[],
  ): Promise<Map<number, CommandCourse[]>> {
    const courses = new Map<number, CommandCourse[]>();
    if (commands.length === 0) {
      return courses;
    }
    const rows = await this.commands.query<CourseRow[]>(
      `SELECT link.command_id AS "commandId", course.id, course.title, ue.code AS "ueCode"
         FROM command_courses link
         JOIN courses course ON course.id = link.course_id
         JOIN ues ue ON ue.id = course.ue_id
        WHERE link.command_id = ANY($1)
        ORDER BY ue.position, course.position, course.id`,
      [commands.map((command) => command.id)],
    );
    for (const { commandId, ...course } of rows) {
      courses.set(commandId, [...(courses.get(commandId) ?? []), course]);
    }
    return courses;
  }

  // Reporte sur la commande les champs fournis ; ceux qui manquent gardent leur valeur.
  private async apply(
    command: Command,
    input: UpdateCommandDto,
    tool: Tool,
  ): Promise<void> {
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
    if (input.ueCodes !== undefined) {
      command.ues = await this.findUes(input.ueCodes);
    }
    if (input.courseIds !== undefined) {
      command.courses = await this.findCourseRefs(input.courseIds);
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

  private async findUes(codes: string[]): Promise<Ue[]> {
    const wanted = [...new Set(codes.map((code) => code.trim().toUpperCase()))];
    const ues = await this.ues.findBy({ code: In(wanted) });
    const missing = wanted.find((code) => !ues.some((ue) => ue.code === code));
    if (missing !== undefined) {
      throw new BadRequestException(`L’UE ${missing} n’existe pas.`);
    }
    return ues;
  }

  // Cours désignés par leur numéro, sans leur contenu : seul le lien est enregistré.
  private async findCourseRefs(ids: number[]): Promise<Course[]> {
    const wanted = [...new Set(ids)];
    const courses = await this.courses.find({
      select: { id: true },
      where: { id: In(wanted) },
    });
    const missing = wanted.find((id) => !courses.some((c) => c.id === id));
    if (missing !== undefined) {
      throw new BadRequestException(`Le cours n° ${missing} n’existe pas.`);
    }
    return courses;
  }

  private async save(command: Command): Promise<Command> {
    command.plainText = buildPlainText(command);
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
  tool: true,
  mode: true,
  variants: true,
  ues: true,
  options: { variants: true },
  examples: true,
} as const;

const ORDER = {
  ues: { position: 'ASC' },
  options: { position: 'ASC' },
  examples: { position: 'ASC' },
} as const;

function key(name: string): string {
  return name.toLowerCase();
}

// Texte d'une commande pour la recherche : syntaxe, options, exemples et notes. La
// sortie des exemples n'en fait pas partie : elle noierait les résultats.
export function buildPlainText(command: Command): string {
  return [
    command.syntax,
    ...command.options.map((option) =>
      [option.text, option.description].filter(Boolean).join(' '),
    ),
    ...command.examples.flatMap((example) => [
      example.explanation,
      example.line,
    ]),
    command.notes,
  ]
    .filter(Boolean)
    .join('\n');
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
  courses: Map<number, CommandCourse[]>,
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
    ueCodes: command.ues.map((ue) => ue.code),
    courses: courses.get(command.id) ?? [],
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
