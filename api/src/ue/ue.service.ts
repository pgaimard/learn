import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUeDto } from './dto/create-ue.dto.js';
import { UpdateUeDto } from './dto/update-ue.dto.js';
import { Ue } from './ue.entity.js';

const UNIQUE_VIOLATION = '23505';
// PostgreSQL signale une suppression bloquée par ON DELETE RESTRICT avec 23001,
// et les autres violations de clé étrangère avec 23503.
const REFERENCED_ROW_CODES = ['23001', '23503'];

// Nombre de cours, de termes et de fichiers rattachés à une UE.
export interface UeCounts {
  courses: number;
  terms: number;
  files: number;
}

export type UeWithCounts = Ue & { counts: UeCounts };

interface CountsRow extends UeCounts {
  ue_id: number;
}

const NO_COUNTS: UeCounts = { courses: 0, terms: 0, files: 0 };

@Injectable()
export class UeService {
  constructor(@InjectRepository(Ue) private readonly ues: Repository<Ue>) {}

  findAll(): Promise<Ue[]> {
    return this.ues.find({ order: { position: 'ASC', code: 'ASC' } });
  }

  // UE avec leurs compteurs, pour l'accueil.
  async findAllWithCounts(): Promise<UeWithCounts[]> {
    return this.withCounts(await this.findAll());
  }

  async findByCodeWithCounts(code: string): Promise<UeWithCounts> {
    const [ue] = await this.withCounts([await this.findByCode(code)]);
    return ue;
  }

  async findByCode(code: string): Promise<Ue> {
    const ue = await this.ues.findOneBy({ code: code.toUpperCase() });
    if (!ue) {
      throw new NotFoundException(`L’UE ${code} n’existe pas.`);
    }
    return ue;
  }

  async create(input: CreateUeDto): Promise<Ue> {
    // Une nouvelle UE se place à la suite ; l'ordre se change ensuite par reorder.
    const position = await this.nextPosition();
    return this.save(this.ues.create({ ...input, position }), input.code);
  }

  async update(code: string, changes: UpdateUeDto): Promise<Ue> {
    const ue = await this.findByCode(code);
    return this.save(this.ues.merge(ue, changes), changes.code ?? ue.code);
  }

  // Réordonne toutes les UE : la liste doit les contenir toutes, une fois chacune.
  async reorder(codes: string[]): Promise<Ue[]> {
    const ordered = codes.map((code) => code.trim().toUpperCase());
    const existing = await this.ues.find({ select: { id: true, code: true } });
    const ids = new Map(existing.map((ue) => [ue.code, ue.id]));
    if (
      ordered.length !== existing.length ||
      new Set(ordered).size !== ordered.length ||
      ordered.some((code) => !ids.has(code))
    ) {
      throw new BadRequestException(
        'L’ordre doit contenir toutes les UE, une fois chacune.',
      );
    }
    await this.ues.manager.transaction(async (manager) => {
      for (const [index, code] of ordered.entries()) {
        await manager.update(
          Ue,
          { id: ids.get(code) },
          { position: index + 1 },
        );
      }
    });
    return this.findAll();
  }

  async remove(code: string): Promise<void> {
    const ue = await this.findByCode(code);
    try {
      await this.ues.remove(ue);
    } catch (error) {
      if (REFERENCED_ROW_CODES.some((code) => hasErrorCode(error, code))) {
        throw new ConflictException(
          `L’UE ${ue.code} n’est pas vide : supprimez d’abord ses cours, ses dossiers et ses fichiers.`,
        );
      }
      throw error;
    }
  }

  private async withCounts(ues: Ue[]): Promise<UeWithCounts[]> {
    const rows = await this.ues.query<CountsRow[]>(
      `SELECT u.id AS ue_id,
              (SELECT count(*)::int FROM courses c WHERE c.ue_id = u.id) AS courses,
              (SELECT count(*)::int FROM terms t WHERE t.ue_id = u.id) AS terms,
              (SELECT count(*)::int FROM files f WHERE f.ue_id = u.id) AS files
         FROM ues u
        WHERE u.id = ANY($1)`,
      [ues.map((ue) => ue.id)],
    );
    const counts = new Map(
      rows.map(({ ue_id, ...count }): [number, UeCounts] => [ue_id, count]),
    );
    return ues.map((ue) => ({ ...ue, counts: counts.get(ue.id) ?? NO_COUNTS }));
  }

  private async nextPosition(): Promise<number> {
    const last = await this.ues.maximum('position');
    return (last ?? 0) + 1;
  }

  private async save(ue: Ue, code: string): Promise<Ue> {
    try {
      return await this.ues.save(ue);
    } catch (error) {
      if (hasErrorCode(error, UNIQUE_VIOLATION)) {
        throw new ConflictException(`Une UE porte déjà le code ${code}.`);
      }
      throw error;
    }
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === code
  );
}
