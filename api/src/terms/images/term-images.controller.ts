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
import { buildImageSource } from '../../courses/content/collect-figures.js';
import { MAX_IMAGE_SIZE } from '../../courses/images/course-images.service.js';
import {
  imageHeaders,
  ReceivedFile,
  UploadedImageResponse,
} from '../../courses/images/image-http.js';
import { UploadImageDto } from '../../courses/images/upload-image.dto.js';
import { TermImagesService } from './term-images.service.js';

// Un identifiant non numérique désigne une ressource qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Cette image n’existe pas.'),
});

@Controller('terms/:termId/images')
export class TermImagesController {
  constructor(private readonly imagesService: TermImagesService) {}

  @Post()
  // Un octet de marge : le dépassement est signalé par le service, en français.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE + 1, files: 1 },
    }),
  )
  async upload(
    @Param('termId', parseId) termId: number,
    @UploadedFile() file: ReceivedFile | undefined,
    @Body() body: UploadImageDto,
  ): Promise<UploadedImageResponse> {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    const image = await this.imagesService.upload(
      termId,
      file.buffer,
      body.altText ?? '',
    );
    return {
      id: image.id,
      src: buildImageSource('terms', termId, image.id),
      mimeType: image.mimeType,
      size: image.size,
      altText: image.altText,
    };
  }

  @Get(':imageId')
  async download(
    @Param('termId', parseId) termId: number,
    @Param('imageId', parseId) imageId: number,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { image, stream } = await this.imagesService.open(termId, imageId);
    response.set(imageHeaders(image));
    return new StreamableFile(stream);
  }
}
