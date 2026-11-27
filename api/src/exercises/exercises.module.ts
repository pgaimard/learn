import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/course.entity.js';
import { ExerciseAttempt } from './exercise-attempt.entity.js';
import { ExercisesController } from './exercises.controller.js';
import { ExercisesService } from './exercises.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseAttempt, Course])],
  controllers: [ExercisesController],
  providers: [ExercisesService],
})
export class ExercisesModule {}
