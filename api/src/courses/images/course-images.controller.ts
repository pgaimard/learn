import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { buildImageSource } from '../content/collect-figures.js';
import {
  CourseImagesService,
  MAX_IMAGE_SIZE,
} from './course-images.service.js';
import {
  imageHeaders,
  ReceivedFile,
  UploadedImageResponse,
} from './image-http.js';
import { UploadImageDto } from './upload-image.dto.js';

export type { UploadedImageResponse };

// Un identifiant non numérique désigne une ressource qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cette image n’existe pas.'),
});

@Controller('courses/:courseId/images')
export class CourseImagesController {
  constructor(private readonly imagesService: CourseImagesService) {}

  @Post()
  // Un octet de marge : le dépassement est signalé par le service, en français.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE + 1, files: 1 },
    }),
  )
  async upload(
    @Param('courseId', parseId) courseId: number,
    @UploadedFile() file: ReceivedFile | undefined,
    @Body() body: UploadImageDto,
  ): Promise<UploadedImageResponse> {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    const image = await this.imagesService.upload(
      courseId,
      file.buffer,
      body.altText ?? '',
    );
    return {
      id: image.id,
      src: buildImageSource('courses', courseId, image.id),
      mimeType: image.mimeType,
      size: image.size,
      altText: image.altText,
    };
  }

  @Get(':imageId')
  async download(
    @Param('courseId', parseId) courseId: number,
    @Param('imageId', parseId) imageId: number,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { image, stream } = await this.imagesService.open(courseId, imageId);
    response.set(imageHeaders(image));
    return new StreamableFile(stream);
  }
}
