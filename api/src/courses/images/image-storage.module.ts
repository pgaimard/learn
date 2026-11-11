import { Module } from '@nestjs/common';
import { ImageStorageService } from './image-storage.service.js';

// Stockage des images sur disque, partagé par les cours et les termes.
@Module({
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class ImageStorageModule {}
