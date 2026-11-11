import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UeModule } from '../ue/ue.module.js';
import { Folder } from './folders/folder.entity.js';
import { FoldersController } from './folders/folders.controller.js';
import { FoldersService } from './folders/folders.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Folder]), UeModule],
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FilesModule {}
