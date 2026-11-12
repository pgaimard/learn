import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ue } from '../ue/ue.entity.js';
import { CreateEventsDto, ListEventsDto, UpdateEventDto } from './event.dto.js';
import { AgendaEvent } from './event.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PERIOD_DAYS = 62;

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(AgendaEvent)
    private readonly events: Repository<AgendaEvent>,
    @InjectRepository(Ue) private readonly ues: Repository<Ue>,
  ) {}

  async findAll(filters: ListEventsDto): Promise<AgendaEvent[]> {
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    if (
      to <= from ||
      to.getTime() - from.getTime() > MAX_PERIOD_DAYS * DAY_MS
    ) {
      throw new BadRequestException(
        `La période doit être positive et ne pas dépasser ${MAX_PERIOD_DAYS} jours.`,
      );
    }
    const query = this.events
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.ue', 'ue')
      .where('event.starts_at < :to AND event.ends_at >= :from', { from, to })
      .orderBy('event.startsAt', 'ASC')
      .addOrderBy('event.id', 'ASC');
    if (filters.ue !== undefined) {
      const ue = await this.findUe(filters.ue, NotFoundException);
      query.andWhere('event.ue_id = :ueId', { ueId: ue.id });
    }
    return query.getMany();
  }

  async findById(id: number): Promise<AgendaEvent> {
    const event = await this.events.findOne({
      where: { id },
      relations: { ue: true },
    });
    if (!event) {
      throw new NotFoundException('Cet événement n’existe pas.');
    }
    return event;
  }

  // Crée un événement par occurrence, tous ou aucun.
  async create(input: CreateEventsDto): Promise<AgendaEvent[]> {
    const ueId = await this.resolveUeId(input.ueCode, null);
    const events = input.occurrences.map((occurrence) =>
      this.events.create({
        title: input.title,
        description: input.description ?? '',
        type: input.type,
        ueId,
        ...toPeriod(occurrence.startsAt, occurrence.endsAt),
      }),
    );
    const saved = await this.events.manager.transaction((manager) =>
      manager.save(events),
    );
    return this.events.find({
      where: { id: In(saved.map((event) => event.id)) },
      relations: { ue: true },
      order: { startsAt: 'ASC', id: 'ASC' },
    });
  }

  async update(id: number, changes: UpdateEventDto): Promise<AgendaEvent> {
    const event = await this.findById(id);
    await this.events.update(
      { id },
      {
        title: changes.title ?? event.title,
        description: changes.description ?? event.description,
        type: changes.type ?? event.type,
        ueId: await this.resolveUeId(changes.ueCode, event.ueId),
        ...toPeriod(
          changes.startsAt ?? event.startsAt,
          changes.endsAt ?? event.endsAt,
        ),
      },
    );
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const event = await this.findById(id);
    await this.events.delete({ id: event.id });
  }

  // undefined : inchangé ; null : sans UE.
  private async resolveUeId(
    ueCode: string | null | undefined,
    current: number | null,
  ): Promise<number | null> {
    if (ueCode === undefined) {
      return current;
    }
    return ueCode === null
      ? null
      : (await this.findUe(ueCode, BadRequestException)).id;
  }

  private async findUe(
    code: string,
    Failure: typeof BadRequestException | typeof NotFoundException,
  ): Promise<Ue> {
    const ue = await this.ues.findOneBy({ code: code.trim().toUpperCase() });
    if (!ue) {
      throw new Failure(`L’UE ${code} n’existe pas.`);
    }
    return ue;
  }
}

function toPeriod(
  start: string | Date,
  end: string | Date,
): Pick<AgendaEvent, 'startsAt' | 'endsAt'> {
  const startsAt = new Date(start);
  const endsAt = new Date(end);
  if (endsAt < startsAt) {
    throw new BadRequestException('La fin ne peut pas précéder le début.');
  }
  return { startsAt, endsAt };
}
