import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Term } from '../terms/term.entity.js';
import { TermsModule } from '../terms/terms.module.js';
import { UeModule } from '../ue/ue.module.js';
import { Course } from './course.entity.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { CourseImage } from './images/course-image.entity.js';
import { CourseImagesController } from './images/course-images.controller.js';
import { CourseImagesService } from './images/course-images.service.js';
import { ImageStorageModule } from './images/image-storage.module.js';
import { CourseImportService } from './import/course-import.service.js';
import { CourseImportsController } from './import/course-imports.controller.js';

@Module({
  imports: [
    // Term : l'import d'un paquet crée les termes de son glossaire.
    TypeOrmModule.forFeature([Course, CourseImage, Term]),
    UeModule,
    ImageStorageModule,
    TermsModule,
  ],
  controllers: [
    CoursesController,
    CourseImagesController,
    CourseImportsController,
  ],
  providers: [CoursesService, CourseImagesService, CourseImportService],
  exports: [CoursesService],
})
export class CoursesModule {}
