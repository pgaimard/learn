import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ue } from '../ue/ue.entity.js';
import { CreateTaskDto, ListTasksDto, UpdateTaskDto } from './task.dto.js';
import { Task } from './task.entity.js';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Ue) private readonly ues: Repository<Ue>,
  ) {}

  // À faire d'abord, puis par échéance (les tâches sans échéance en dernier).
  async findAll(filters: ListTasksDto): Promise<Task[]> {
    const query = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.ue', 'ue')
      .orderBy('task.done', 'ASC')
      .addOrderBy('task.dueAt', 'ASC', 'NULLS LAST')
      .addOrderBy('task.id', 'ASC');
    if (filters.ue !== undefined) {
      const ue = await this.findUe(filters.ue, NotFoundException);
      query.andWhere('task.ue_id = :ueId', { ueId: ue.id });
    }
    if (filters.done !== undefined) {
      query.andWhere('task.done = :done', { done: filters.done });
    }
    if (filters.dueFrom !== undefined) {
      query.andWhere('task.due_at >= :dueFrom', { dueFrom: filters.dueFrom });
    }
    if (filters.dueTo !== undefined) {
      query.andWhere('task.due_at < :dueTo', { dueTo: filters.dueTo });
    }
    return query.getMany();
  }

  async findById(id: number): Promise<Task> {
    const task = await this.tasks.findOne({
      where: { id },
      relations: { ue: true },
    });
    if (!task) {
      throw new NotFoundException('Cette tâche n’existe pas.');
    }
    return task;
  }

  async create(input: CreateTaskDto): Promise<Task> {
    const saved = await this.tasks.save(
      this.tasks.create({
        title: input.title,
        ueId: await this.resolveUeId(input.ueCode, null),
        dueAt: toDate(input.dueAt, null),
        remindAt: toDate(input.remindAt, null),
        done: input.done ?? false,
      }),
    );
    return this.findById(saved.id);
  }

  async update(id: number, changes: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(id);
    await this.tasks.update(
      { id },
      {
        title: changes.title ?? task.title,
        ueId: await this.resolveUeId(changes.ueCode, task.ueId),
        dueAt: toDate(changes.dueAt, task.dueAt),
        remindAt: toDate(changes.remindAt, task.remindAt),
        done: changes.done ?? task.done,
      },
    );
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const task = await this.findById(id);
    await this.tasks.delete({ id: task.id });
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

// undefined : inchangé ; null : date effacée.
function toDate(
  value: string | null | undefined,
  current: Date | null,
): Date | null {
  if (value === undefined) {
    return current;
  }
  return value === null ? null : new Date(value);
}
