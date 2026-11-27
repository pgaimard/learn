import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Term } from '../terms/term.entity.js';
import { TermsModule } from '../terms/terms.module.js';
import { FilesModule } from '../files/files.module.js';
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
import { CourseSnapshot } from './snapshots/course-snapshot.entity.js';
import { CourseSnapshotsController } from './snapshots/course-snapshots.controller.js';
import { CourseSnapshotsService } from './snapshots/course-snapshots.service.js';

@Module({
  imports: [
    // Term : l'import d'un paquet crée les termes de son glossaire.
    TypeOrmModule.forFeature([Course, CourseImage, CourseSnapshot, Term]),
    UeModule,
    FilesModule,
    ImageStorageModule,
    TermsModule,
  ],
  controllers: [
    CoursesController,
    CourseImagesController,
    CourseImportsController,
    CourseSnapshotsController,
  ],
  providers: [
    CoursesService,
    CourseImagesService,
    CourseImportService,
    CourseSnapshotsService,
  ],
  exports: [CoursesService],
})
export class CoursesModule {}
