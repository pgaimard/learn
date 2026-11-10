import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UeService } from '../ue/ue.service.js';
import { ContentNode, EMPTY_CONTENT } from './content/content-node.js';
import { extractPlainText } from './content/extract-plain-text.js';
import { validateContent } from './content/validate-content.js';
import { Course } from './course.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

const UNIQUE_VIOLATION = '23505';

export type CourseSummary = Pick<
  Course,
  'id' | 'title' | 'position' | 'updatedAt'
>;

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    private readonly ueService: UeService,
  ) {}

  async findAllByUe(ueCode: string): Promise<CourseSummary[]> {
    const ue = await this.ueService.findByCode(ueCode);
    return this.courses.find({
      select: { id: true, title: true, position: true, updatedAt: true },
      where: { ueId: ue.id },
      order: { position: 'ASC' },
    });
  }

  async findById(id: number): Promise<Course> {
    const course = await this.courses.findOne({
      where: { id },
      relations: { ue: true },
    });
    if (!course) {
      throw new NotFoundException('Ce cours n’existe pas.');
    }
    return course;
  }

  async create(ueCode: string, input: CreateCourseDto): Promise<Course> {
    const ue = await this.ueService.findByCode(ueCode);
    const content = checkContent(input.content ?? EMPTY_CONTENT);
    const course = this.courses.create({
      ueId: ue.id,
      title: input.title,
      position: input.position ?? (await this.nextPosition(ue.id)),
      content,
      plainText: extractPlainText(content),
    });
    return this.save(course);
  }

  async update(id: number, changes: UpdateCourseDto): Promise<Course> {
    const course = await this.findById(id);
    course.title = changes.title ?? course.title;
    course.position = changes.position ?? course.position;
    if (changes.content !== undefined) {
      course.content = checkContent(changes.content);
      course.plainText = extractPlainText(course.content);
    }
    return this.save(course);
  }

  async remove(id: number): Promise<void> {
    await this.courses.remove(await this.findById(id));
  }

  private async nextPosition(ueId: number): Promise<number> {
    const last = await this.courses.maximum('position', { ueId });
    return (last ?? 0) + 1;
  }

  private async save(course: Course): Promise<Course> {
    try {
      const saved = await this.courses.save(course);
      return await this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Un cours occupe déjà l’ordre ${course.position} dans cette UE.`,
        );
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
  return content as ContentNode;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
  );
}
