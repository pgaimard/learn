import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ue } from '../ue/ue.entity.js';
import { Command, CommandExample, CommandOption } from './command.entity.js';
import { CommandsController } from './commands.controller.js';
import { CommandsService } from './commands.service.js';
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
    ]),
  ],
  controllers: [ToolsController, CommandsController],
  providers: [ToolsService, CommandsService],
})
export class ToolsModule {}
