import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageStorageModule } from '../courses/images/image-storage.module.js';
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';
import { TermImage } from './images/term-image.entity.js';
import { TermImagesController } from './images/term-images.controller.js';
import { TermImagesService } from './images/term-images.service.js';
import { Term } from './term.entity.js';
import { TermsController } from './terms.controller.js';
import { TermsService } from './terms.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Term, TermImage, Ue, Course]),
    ImageStorageModule,
  ],
  controllers: [TermsController, TermImagesController],
  providers: [TermsService, TermImagesService],
  // TermImagesService : l'import d'un paquet enregistre les images des définitions.
  exports: [TermsService, TermImagesService],
})
export class TermsModule {}
