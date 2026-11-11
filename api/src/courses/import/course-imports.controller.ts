import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Course } from '../course.entity.js';
import { CourseImportService, ImportPreview } from './course-import.service.js';
import {
  MarkdownImportDto,
  MarkdownPreviewDto,
  PackageImportDto,
} from './import.dto.js';
import { MAX_PACKAGE_SIZE, PackageFiles, readPackage } from './read-package.js';

// Seule partie utile du fichier reçu en mémoire par multer.
interface ReceivedFile {
  buffer: Buffer;
}

// Un octet de marge : le dépassement est signalé ci-dessous, en français.
const packageUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_PACKAGE_SIZE + 1, files: 1 },
});

function readUpload(file: ReceivedFile | undefined): Promise<PackageFiles> {
  if (!file) {
    throw new BadRequestException('Aucun fichier reçu.');
  }
  if (file.buffer.length > MAX_PACKAGE_SIZE) {
    throw new PayloadTooLargeException(
      'Le paquet dépasse la taille maximale de 50 Mo.',
    );
  }
  return readPackage(file.buffer);
}

function fromMarkdown(markdown: string): PackageFiles {
  return { markdown, images: new Map(), terms: null };
}

@Controller('course-imports')
export class CourseImportsController {
  constructor(private readonly importService: CourseImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(packageUpload)
  async previewPackage(
    @UploadedFile() file: ReceivedFile | undefined,
  ): Promise<ImportPreview> {
    return this.importService.preview(await readUpload(file));
  }

  @Post()
  @UseInterceptors(packageUpload)
  async importPackage(
    @UploadedFile() file: ReceivedFile | undefined,
    @Body() options: PackageImportDto,
  ): Promise<Course> {
    return this.importService.import(
      await readUpload(file),
      options.replace ?? false,
    );
  }

  @Post('markdown/preview')
  @HttpCode(HttpStatus.OK)
  previewMarkdown(@Body() input: MarkdownPreviewDto): Promise<ImportPreview> {
    return this.importService.preview(fromMarkdown(input.markdown));
  }

  @Post('markdown')
  importMarkdown(@Body() input: MarkdownImportDto): Promise<Course> {
    return this.importService.import(
      fromMarkdown(input.markdown),
      input.replace ?? false,
    );
  }
}
