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
  Query,
} from '@nestjs/common';
import { CreateEventsDto, ListEventsDto, UpdateEventDto } from './event.dto.js';
import { AgendaEvent } from './event.entity.js';
import { EventsService } from './events.service.js';

// Un identifiant non numérique désigne un événement qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cet événement n’existe pas.'),
});

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Query() filters: ListEventsDto): Promise<AgendaEvent[]> {
    return this.eventsService.findAll(filters);
  }

  @Post()
  create(@Body() input: CreateEventsDto): Promise<AgendaEvent[]> {
    return this.eventsService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateEventDto,
  ): Promise<AgendaEvent> {
    return this.eventsService.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.eventsService.remove(id);
  }
}
