import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ue } from '../ue/ue.entity.js';
import { AgendaEvent } from './event.entity.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgendaEvent, Ue])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
