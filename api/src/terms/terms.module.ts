import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';
import { Term } from './term.entity.js';
import { TermsController } from './terms.controller.js';
import { TermsService } from './terms.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Term, Ue, Course])],
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
