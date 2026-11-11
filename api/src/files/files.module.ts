import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UeModule } from '../ue/ue.module.js';
import { FileStorageService } from './file-storage.service.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { Folder } from './folders/folder.entity.js';
import { FoldersController } from './folders/folders.controller.js';
import { FoldersService } from './folders/folders.service.js';
import { StoredFile } from './stored-file.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, StoredFile]), UeModule],
  controllers: [FoldersController, FilesController],
  providers: [FoldersService, FilesService, FileStorageService],
})
export class FilesModule {}
