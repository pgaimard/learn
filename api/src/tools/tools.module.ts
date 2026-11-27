import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/course.entity.js';
import { Ue } from '../ue/ue.entity.js';
import { Command, CommandExample, CommandOption } from './command.entity.js';
import {
  CommandLinksController,
  CommandsController,
} from './commands.controller.js';
import { CommandsService } from './commands.service.js';
import { CommandImportService } from './import/command-import.service.js';
import { CommandImportsController } from './import/command-imports.controller.js';
import { Tool, ToolMode, ToolVariant } from './tool.entity.js';
import { ToolsController } from './tools.controller.js';
import { ToolsService } from './tools.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tool,
      ToolMode,
      ToolVariant,
      Command,
      CommandOption,
      CommandExample,
      Ue,
      Course,
    ]),
  ],
  controllers: [
    ToolsController,
    CommandsController,
    CommandLinksController,
    CommandImportsController,
  ],
  providers: [ToolsService, CommandsService, CommandImportService],
  exports: [ToolsService, CommandsService],
})
export class ToolsModule {}
