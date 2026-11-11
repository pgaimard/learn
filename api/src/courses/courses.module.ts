import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UeModule } from '../ue/ue.module.js';
import { Course } from './course.entity.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { CourseImage } from './images/course-image.entity.js';
import { CourseImagesController } from './images/course-images.controller.js';
import { CourseImagesService } from './images/course-images.service.js';
import { ImageStorageService } from './images/image-storage.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseImage]), UeModule],
  controllers: [CoursesController, CourseImagesController],
  providers: [CoursesService, CourseImagesService, ImageStorageService],
  exports: [CoursesService],
})
export class CoursesModule {}
