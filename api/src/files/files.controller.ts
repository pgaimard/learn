import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { attachmentDisposition } from './file-name.js';
import { ListFilesDto, UpdateFileDto, UploadFileDto } from './file.dto.js';
import {
  FilesService,
  FileSummary,
  MAX_FILE_SIZE,
  ReceivedUpload,
} from './files.service.js';

// Un identifiant non numérique désigne un fichier qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Ce fichier n’existe pas.'),
});

@Controller()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('ues/:code/files')
  findAll(
    @Param('code') code: string,
    @Query() filters: ListFilesDto,
  ): Promise<FileSummary[]> {
    return this.filesService.findAll(code, filters.folder ?? null);
  }

  @Post('ues/:code/files')
  // Un octet de marge : le dépassement est signalé par le service, en français.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE + 1, files: 1 },
      // Sans cela, un nom de fichier accentué arrive mal décodé.
      defParamCharset: 'utf8',
    }),
  )
  upload(
    @Param('code') code: string,
    @UploadedFile() file: ReceivedUpload | undefined,
    @Body() body: UploadFileDto,
  ): Promise<FileSummary> {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    return this.filesService.upload(code, body.folderId ?? null, file);
  }

  @Get('files/:id/download')
  async download(
    @Param('id', parseId) id: number,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { file, stream } = await this.filesService.open(id);
    // Toujours en pièce jointe et sous un type neutre : un fichier envoyé n'est jamais
    // affiché ni exécuté dans l'application, quel que soit son contenu.
    response.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(file.size),
      'Content-Disposition': attachmentDisposition(file.name),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(stream);
  }

  @Patch('files/:id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateFileDto,
  ): Promise<FileSummary> {
    return this.filesService.update(id, changes);
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.filesService.remove(id);
  }
}
