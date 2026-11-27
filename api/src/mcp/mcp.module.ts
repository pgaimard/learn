import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { CoursesModule } from '../courses/courses.module.js';
import { UeModule } from '../ue/ue.module.js';
import { AiAccessToken } from './ai-access-token.entity.js';
import { AiAccessController } from './ai-access.controller.js';
import { AiAccessGuard } from './ai-access.guard.js';
import { AiAccessService } from './ai-access.service.js';
import { CourseReaderService } from './course-reader.service.js';
import { McpToolsService } from './mcp-tools.service.js';
import { McpController } from './mcp.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAccessToken]),
    AuthModule,
    UeModule,
    CoursesModule,
  ],
  controllers: [AiAccessController, McpController],
  providers: [
    AiAccessService,
    AiAccessGuard,
    CourseReaderService,
    McpToolsService,
  ],
})
export class McpModule {}
