import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ue } from '../ue/ue.entity.js';
import { Tool, ToolMode, ToolVariant } from './tool.entity.js';
import { ToolsController } from './tools.controller.js';
import { ToolsService } from './tools.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Tool, ToolMode, ToolVariant, Ue])],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
