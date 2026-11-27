import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Course } from '../course.entity.js';
import { CoursesService } from '../courses.service.js';
import {
  CourseSnapshotsService,
  SnapshotSummary,
} from './course-snapshots.service.js';
import { RestoreSnapshotDto } from './restore-snapshot.dto.js';

// Un identifiant non numérique désigne une version qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () =>
    new NotFoundException('Cette version du cours n’existe pas.'),
});

@Controller('courses/:courseId/snapshots')
export class CourseSnapshotsController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly snapshotsService: CourseSnapshotsService,
  ) {}

  @Get()
  async findAll(
    @Param('courseId', parseId) courseId: number,
  ): Promise<SnapshotSummary[]> {
    await this.coursesService.findById(courseId);
    return this.snapshotsService.list(courseId);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('courseId', parseId) courseId: number,
    @Param('id', parseId) id: number,
    @Body() body: RestoreSnapshotDto,
  ): Promise<Course> {
    return this.coursesService.restoreSnapshot(courseId, id, body.revision);
  }
}
