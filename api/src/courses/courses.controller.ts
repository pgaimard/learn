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
  Put,
} from '@nestjs/common';
import { Course } from './course.entity.js';
import { CourseSummary, CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { ReorderCoursesDto } from './dto/reorder-courses.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

// Un identifiant non numérique désigne un cours qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Ce cours n’existe pas.'),
});

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('ues/:code/courses')
  findAllByUe(@Param('code') code: string): Promise<CourseSummary[]> {
    return this.coursesService.findAllByUe(code);
  }

  @Post('ues/:code/courses')
  create(
    @Param('code') code: string,
    @Body() input: CreateCourseDto,
  ): Promise<Course> {
    return this.coursesService.create(code, input);
  }

  @Put('ues/:code/courses/order')
  reorder(
    @Param('code') code: string,
    @Body() input: ReorderCoursesDto,
  ): Promise<CourseSummary[]> {
    return this.coursesService.reorder(code, input.ids);
  }

  @Get('courses/:id')
  findOne(@Param('id', parseId) id: number): Promise<Course> {
    return this.coursesService.findById(id);
  }

  @Patch('courses/:id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateCourseDto,
  ): Promise<Course> {
    return this.coursesService.update(id, changes);
  }

  @Delete('courses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.coursesService.remove(id);
  }
}
