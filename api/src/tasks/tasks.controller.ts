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
import { CreateTaskDto, ListTasksDto, UpdateTaskDto } from './task.dto.js';
import { Task } from './task.entity.js';
import { TasksService } from './tasks.service.js';

// Un identifiant non numérique désigne une tâche qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cette tâche n’existe pas.'),
});

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Query() filters: ListTasksDto): Promise<Task[]> {
    return this.tasksService.findAll(filters);
  }

  @Post()
  create(@Body() input: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.tasksService.remove(id);
  }
}
