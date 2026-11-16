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
  Query,
} from '@nestjs/common';
import { CourseFolderSummary } from '../files/folders/course-folders.service.js';
import { Course } from './course.entity.js';
import { CourseSummary, CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { RemoveCourseDto } from './dto/remove-course.dto.js';
import { ReorderCoursesDto } from './dto/reorder-courses.dto.js';
import { SetBookmarkDto } from './dto/set-bookmark.dto.js';
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

  @Put('courses/:id/bookmark')
  setBookmark(
    @Param('id', parseId) id: number,
    @Body() bookmark: SetBookmarkDto,
  ): Promise<Course> {
    return this.coursesService.setBookmark(id, bookmark);
  }

  @Delete('courses/:id/bookmark')
  removeBookmark(@Param('id', parseId) id: number): Promise<Course> {
    return this.coursesService.setBookmark(id, null);
  }

  // Dossier de fichiers du cours et ce qu'il contient ; null s'il n'en a pas.
  @Get('courses/:id/folder')
  findFolder(
    @Param('id', parseId) id: number,
  ): Promise<CourseFolderSummary | null> {
    return this.coursesService.findFolder(id);
  }

  // ?folder=delete supprime aussi le dossier de fichiers du cours et son contenu.
  @Delete('courses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', parseId) id: number,
    @Query() options: RemoveCourseDto,
  ): Promise<void> {
    return this.coursesService.remove(id, options.folder === 'delete');
  }
}
