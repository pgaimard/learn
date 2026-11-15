import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandImportDto, CommandPreviewDto } from './command-import.dto.js';
import { CommandImportPreview } from './command-import.js';
import { CommandImportService } from './command-import.service.js';

@Controller('command-imports')
export class CommandImportsController {
  constructor(private readonly importService: CommandImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() input: CommandPreviewDto): Promise<CommandImportPreview> {
    return this.importService.preview(input.content);
  }

  @Post()
  import(@Body() input: CommandImportDto): Promise<CommandImportPreview> {
    return this.importService.import(input.content, input.replace ?? false);
  }
}
