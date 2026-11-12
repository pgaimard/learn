import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { collectFigures } from '../courses/content/collect-figures.js';
import { ContentNode, EMPTY_CONTENT } from '../courses/content/content-node.js';
import { extractPlainText } from '../courses/content/extract-plain-text.js';
import { validateContent } from '../courses/content/validate-content.js';
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';
import { CreateTermDto } from './dto/create-term.dto.js';
import { ListTermsDto } from './dto/list-terms.dto.js';
import { UpdateTermDto } from './dto/update-term.dto.js';
import { TermImagesService } from './images/term-images.service.js';
import { resolveExpandedForm } from './term-rules.js';
import { Term } from './term.entity.js';

const UNIQUE_VIOLATION = '23505';
const EXCERPT_LENGTH = 200;

export interface TermSummary extends Pick<
  Term,
  'id' | 'type' | 'label' | 'expandedForm'
> {
  // Début de la définition en texte brut.
  excerpt: string;
  // Origine du terme : code de son UE, cours dont il est issu ; null s'il n'en a pas.
  ueCode: string | null;
  courseId: number | null;
  courseTitle: string | null;
}

type Origin = Pick<Term, 'ueId' | 'courseId'>;
type OriginRequest = Pick<CreateTermDto, 'ueCode' | 'courseId'>;

@Injectable()
export class TermsService {
  constructor(
    @InjectRepository(Term) private readonly terms: Repository<Term>,
    @InjectRepository(Ue) private readonly ues: Repository<Ue>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly imagesService: TermImagesService,
  ) {}

  async findAll(filters: ListTermsDto): Promise<TermSummary[]> {
    const query = this.terms
      .createQueryBuilder('term')
      .select('term.id', 'id')
      .addSelect('term.type', 'type')
      .addSelect('term.label', 'label')
      .addSelect('term.expanded_form', 'expandedForm')
      .addSelect('left(term.plain_text, :length)', 'excerpt')
      .leftJoin('term.ue', 'ue')
      .addSelect('ue.code', 'ueCode')
      .leftJoin('term.course', 'course')
      .addSelect('course.id', 'courseId')
      .addSelect('course.title', 'courseTitle')
      .setParameter('length', EXCERPT_LENGTH)
      .orderBy('term.label', 'ASC')
      .addOrderBy('term.id', 'ASC');
    if (filters.type) {
      query.andWhere('term.type = :type', { type: filters.type });
    }
    if (filters.ue !== undefined) {
      const ue = await this.findUe(filters.ue, NotFoundException);
      query.andWhere('term.ue_id = :ueId', { ueId: ue.id });
    }
    if (filters.course !== undefined) {
      query.andWhere('term.course_id = :courseId', {
        courseId: filters.course,
      });
    }
    return query.getRawMany<TermSummary>();
  }

  async findById(id: number): Promise<Term> {
    const term = await this.terms
      .createQueryBuilder('term')
      .leftJoinAndSelect('term.ue', 'ue')
      .leftJoin('term.course', 'course')
      .addSelect(['course.id', 'course.title'])
      .where('term.id = :id', { id })
      .getOne();
    if (!term) {
      throw new NotFoundException('Ce terme n’existe pas.');
    }
    return term;
  }

  async create(input: CreateTermDto): Promise<Term> {
    const content = checkContent(input.content ?? EMPTY_CONTENT);
    if (collectFigures(content).length > 0) {
      throw new BadRequestException(
        'Les images s’ajoutent une fois le terme créé.',
      );
    }
    const origin = await this.resolveOrigin(input, {
      ueId: null,
      courseId: null,
    });
    const term = this.terms.create({
      type: input.type,
      label: input.label,
      expandedForm: resolveExpandedForm(input.type, input.expandedForm, null),
      content,
      plainText: extractPlainText(content),
      ...origin,
    });
    const saved = await this.save(this.terms.manager, term);
    return this.findById(saved.id);
  }

  async update(id: number, changes: UpdateTermDto): Promise<Term> {
    const current = await this.findById(id);
    const type = changes.type ?? current.type;
    const origin = await this.resolveOrigin(changes, current);
    const updates: Partial<Term> = {
      type,
      label: changes.label ?? current.label,
      expandedForm: resolveExpandedForm(
        type,
        changes.expandedForm,
        current.expandedForm,
      ),
      ...origin,
    };
    const term = this.terms.create({ id, ...updates });
    if (changes.content === undefined) {
      await this.save(this.terms.manager, term);
      return this.findById(id);
    }
    term.content = checkContent(changes.content);
    term.plainText = extractPlainText(term.content);
    const figures = collectFigures(term.content);
    await this.imagesService.assertFiguresExist(id, figures);
    // Le terme et ses images changent ensemble ou pas du tout.
    const unused = await this.dataSource.transaction(async (manager) => {
      await this.save(manager, term);
      return this.imagesService.reconcile(manager, id, figures);
    });
    await this.imagesService.removeFiles(unused);
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const term = await this.findById(id);
    const images = await this.imagesService.findByTerm(id);
    await this.terms.delete({ id: term.id });
    await this.imagesService.removeFiles(images);
  }

  // Un cours d'origine impose son UE ; sans cours, l'UE est libre.
  private async resolveOrigin(
    request: OriginRequest,
    current: Origin,
  ): Promise<Origin> {
    const courseId =
      request.courseId === undefined ? current.courseId : request.courseId;
    if (courseId !== null) {
      return this.resolveCourseOrigin(courseId, request.ueCode);
    }
    if (request.ueCode === undefined) {
      return { ueId: current.ueId, courseId: null };
    }
    if (request.ueCode === null) {
      return { ueId: null, courseId: null };
    }
    const ue = await this.findUe(request.ueCode, BadRequestException);
    return { ueId: ue.id, courseId: null };
  }

  private async resolveCourseOrigin(
    courseId: number,
    ueCode: string | null | undefined,
  ): Promise<Origin> {
    const course = await this.courses.findOne({
      select: { id: true, ueId: true },
      where: { id: courseId },
    });
    if (!course) {
      throw new BadRequestException('Le cours d’origine n’existe pas.');
    }
    if (typeof ueCode === 'string') {
      const ue = await this.findUe(ueCode, BadRequestException);
      if (ue.id !== course.ueId) {
        throw new BadRequestException(
          'Le cours d’origine n’appartient pas à cette UE.',
        );
      }
    }
    return { ueId: course.ueId, courseId: course.id };
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

  private async save(manager: EntityManager, term: Term): Promise<Term> {
    try {
      return await manager.save(term);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(duplicateMessage(term));
      }
      throw error;
    }
  }
}

function duplicateMessage(term: Pick<Term, 'type' | 'label'>): string {
  const screen = term.type === 'acronym' ? 'le glossaire' : 'le dictionnaire';
  return `« ${term.label} » existe déjà dans ${screen}.`;
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
