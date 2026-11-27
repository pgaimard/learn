import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseDumper } from './database-dumper.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ExportsController],
  providers: [DatabaseDumper, ExportsService],
})
export class ExportsModule {}
