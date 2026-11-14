import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { collectFigures } from '../courses/content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from '../courses/content/content-node.js';
import { extractPlainText } from '../courses/content/extract-plain-text.js';
import { validateContent } from '../courses/content/validate-content.js';
import { Ue } from '../ue/ue.entity.js';
import { CreateToolDto } from './dto/create-tool.dto.js';
import { UpdateToolDto } from './dto/update-tool.dto.js';
import { mergeItems } from './merge-items.js';
import { Tool, ToolMode, ToolVariant } from './tool.entity.js';

const UNIQUE_VIOLATION = '23505';

// Résumé d'un outil pour la liste.
export interface ToolSummary extends Pick<Tool, 'id' | 'name' | 'summary'> {
  ueCodes: string[];
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool) private readonly tools: Repository<Tool>,
    @InjectRepository(Ue) private readonly ues: Repository<Ue>,
  ) {}

  async findAll(): Promise<ToolSummary[]> {
    const tools = await this.tools.find({
      select: { id: true, name: true, summary: true },
      relations: { ues: true },
    });
    return tools
      .map(({ id, name, summary, ues }) => ({
        id,
        name,
        summary,
        ueCodes: ues.map((ue) => ue.code).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async findById(id: number): Promise<Tool> {
    const tool = await this.tools.findOne({
      where: { id },
      relations: { modes: true, variants: true, ues: true },
      order: {
        modes: { position: 'ASC' },
        variants: { position: 'ASC' },
        ues: { position: 'ASC' },
      },
    });
    if (!tool) {
      throw new NotFoundException('Cet outil n’existe pas.');
    }
    return tool;
  }

  async create(input: CreateToolDto): Promise<Tool> {
    const tool = this.tools.create({
      content: EMPTY_CONTENT,
      plainText: '',
      modes: [],
      variants: [],
      ues: [],
    });
    await this.apply(tool, input);
    const saved = await this.save(tool);
    return this.findById(saved.id);
  }

  async update(id: number, changes: UpdateToolDto): Promise<Tool> {
    const tool = await this.findById(id);
    await this.apply(tool, changes);
    await this.save(tool);
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const tool = await this.findById(id);
    await this.tools.delete({ id: tool.id });
  }

  // Reporte sur l'outil les champs fournis ; ceux qui manquent gardent leur valeur.
  private async apply(tool: Tool, input: UpdateToolDto): Promise<void> {
    tool.name = input.name ?? tool.name;
    tool.summary = input.summary ?? tool.summary ?? '';
    if (input.content !== undefined) {
      tool.content = checkContent(input.content);
      tool.plainText = extractPlainText(tool.content);
    }
    if (input.ueCodes !== undefined) {
      tool.ues = await this.findUes(input.ueCodes);
    }
    if (input.modes !== undefined) {
      tool.modes = mergeItems(tool.modes, input.modes, 'mode', (mode, item) =>
        Object.assign(mode ?? new ToolMode(), {
          name: item.name,
          prompt: item.prompt ?? '',
          entry: item.entry ?? '',
        }),
      );
    }
    if (input.variants !== undefined) {
      tool.variants = mergeItems(
        tool.variants,
        input.variants,
        'déclinaison',
        (variant, item) =>
          Object.assign(variant ?? new ToolVariant(), { name: item.name }),
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

  private async save(tool: Tool): Promise<Tool> {
    try {
      return await this.tools.save(tool);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`L’outil « ${tool.name} » existe déjà.`);
      }
      throw error;
    }
  }
}

function checkContent(content: unknown): ContentNode {
  const errors = validateContent(content);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  if (collectFigures(content as ContentNode).length > 0) {
    throw new BadRequestException(
      'La fiche d’un outil ne peut pas encore contenir d’image.',
    );
  }
  return content as ContentNode;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
  );
}
