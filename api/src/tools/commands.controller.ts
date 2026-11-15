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
} from '@nestjs/common';
import {
  CommandGroup,
  CommandsService,
  CommandView,
} from './commands.service.js';
import { CreateCommandDto } from './dto/create-command.dto.js';
import { UpdateCommandDto } from './dto/update-command.dto.js';

// Un identifiant non numérique désigne un outil ou une commande qui n'existe pas.
const parseToolId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cet outil n’existe pas.'),
});
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cette commande n’existe pas.'),
});

@Controller('tools/:toolId/commands')
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Get()
  findAll(
    @Param('toolId', parseToolId) toolId: number,
  ): Promise<CommandView[]> {
    return this.commandsService.findByTool(toolId);
  }

  @Post()
  create(
    @Param('toolId', parseToolId) toolId: number,
    @Body() input: CreateCommandDto,
  ): Promise<CommandView> {
    return this.commandsService.create(toolId, input);
  }

  @Patch(':id')
  update(
    @Param('toolId', parseToolId) toolId: number,
    @Param('id', parseId) id: number,
    @Body() changes: UpdateCommandDto,
  ): Promise<CommandView> {
    return this.commandsService.update(toolId, id, changes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('toolId', parseToolId) toolId: number,
    @Param('id', parseId) id: number,
  ): Promise<void> {
    return this.commandsService.remove(toolId, id);
  }
}

// Commandes vues depuis une UE ou un cours : celles qui y sont étiquetées.
@Controller()
export class CommandLinksController {
  constructor(private readonly commandsService: CommandsService) {}

  @Get('ues/:code/commands')
  findByUe(@Param('code') code: string): Promise<CommandGroup[]> {
    return this.commandsService.findByUe(code);
  }

  @Get('courses/:id/commands')
  findByCourse(
    @Param(
      'id',
      new ParseIntPipe({
        exceptionFactory: () => new NotFoundException('Ce cours n’existe pas.'),
      }),
    )
    id: number,
  ): Promise<CommandGroup[]> {
    return this.commandsService.findByCourse(id);
  }
}
