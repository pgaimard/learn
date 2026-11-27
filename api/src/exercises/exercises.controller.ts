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
import { ExerciseAttempt } from './exercise-attempt.entity.js';
import {
  GradeAttemptDto,
  SaveDraftDto,
  SubmitAttemptDto,
} from './exercise.dto.js';
import { ExerciseProgress, ExercisesService } from './exercises.service.js';

// Un identifiant non numérique désigne quelque chose qui n'existe pas.
const parseCourseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cet exercice n’existe pas.'),
});
const parseAttemptId = new ParseIntPipe({
  exceptionFactory: () =>
    new NotFoundException('Cette tentative n’existe pas.'),
});

@Controller()
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get('courses/:id/exercises/:key')
  progress(
    @Param('id', parseCourseId) id: number,
    @Param('key') key: string,
  ): Promise<ExerciseProgress> {
    return this.exercisesService.progress(id, key);
  }

  @Put('courses/:id/exercises/:key/draft')
  saveDraft(
    @Param('id', parseCourseId) id: number,
    @Param('key') key: string,
    @Body() input: SaveDraftDto,
  ): Promise<ExerciseAttempt> {
    return this.exercisesService.saveDraft(id, key, input);
  }

  @Delete('courses/:id/exercises/:key/draft')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDraft(
    @Param('id', parseCourseId) id: number,
    @Param('key') key: string,
  ): Promise<void> {
    return this.exercisesService.removeDraft(id, key);
  }

  @Post('courses/:id/exercises/:key/attempts')
  submit(
    @Param('id', parseCourseId) id: number,
    @Param('key') key: string,
    @Body() input: SubmitAttemptDto,
  ): Promise<ExerciseAttempt> {
    return this.exercisesService.submit(id, key, input);
  }

  @Get('exercise-attempts/:id')
  findOne(@Param('id', parseAttemptId) id: number): Promise<ExerciseAttempt> {
    return this.exercisesService.findById(id);
  }

  @Patch('exercise-attempts/:id')
  grade(
    @Param('id', parseAttemptId) id: number,
    @Body() input: GradeAttemptDto,
  ): Promise<ExerciseAttempt> {
    return this.exercisesService.grade(id, input);
  }
}
