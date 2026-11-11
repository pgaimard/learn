import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTermDto } from './dto/create-term.dto.js';
import { ListTermsDto } from './dto/list-terms.dto.js';
import { UpdateTermDto } from './dto/update-term.dto.js';
import { Term } from './term.entity.js';
import { TermSummary, TermsService } from './terms.service.js';

// Un identifiant non numérique désigne un terme qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Ce terme n’existe pas.'),
});

@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  findAll(@Query() filters: ListTermsDto): Promise<TermSummary[]> {
    return this.termsService.findAll(filters);
  }

  @Post()
  create(@Body() input: CreateTermDto): Promise<Term> {
    return this.termsService.create(input);
  }

  @Get(':id')
  findOne(@Param('id', parseId) id: number): Promise<Term> {
    return this.termsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateTermDto,
  ): Promise<Term> {
    return this.termsService.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.termsService.remove(id);
  }
}
