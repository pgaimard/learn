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
import { CreateToolDto } from './dto/create-tool.dto.js';
import { UpdateToolDto } from './dto/update-tool.dto.js';
import { Tool } from './tool.entity.js';
import { ToolSummary, ToolsService } from './tools.service.js';

// Un identifiant non numérique désigne un outil qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cet outil n’existe pas.'),
});

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  findAll(): Promise<ToolSummary[]> {
    return this.toolsService.findAll();
  }

  @Post()
  create(@Body() input: CreateToolDto): Promise<Tool> {
    return this.toolsService.create(input);
  }

  @Get(':id')
  findOne(@Param('id', parseId) id: number): Promise<Tool> {
    return this.toolsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateToolDto,
  ): Promise<Tool> {
    return this.toolsService.update(id, changes);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.toolsService.remove(id);
  }
}
