import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { CoursesModule } from '../courses/courses.module.js';
import { SearchModule } from '../search/search.module.js';
import { TermsModule } from '../terms/terms.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { UeModule } from '../ue/ue.module.js';
import { AiAccessToken } from './ai-access-token.entity.js';
import { AiAccessController } from './ai-access.controller.js';
import { AiAccessGuard } from './ai-access.guard.js';
import { AiAccessService } from './ai-access.service.js';
import { CourseReaderService } from './course-reader.service.js';
import { CourseWriterService } from './course-writer.service.js';
import { McpToolsService } from './mcp-tools.service.js';
import { McpController } from './mcp.controller.js';
import { ReferenceReaderService } from './reference-reader.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAccessToken]),
    AuthModule,
    UeModule,
    CoursesModule,
    TermsModule,
    ToolsModule,
    SearchModule,
  ],
  controllers: [AiAccessController, McpController],
  providers: [
    AiAccessService,
    AiAccessGuard,
    CourseReaderService,
    CourseWriterService,
    McpToolsService,
    ReferenceReaderService,
  ],
})
export class McpModule {}
