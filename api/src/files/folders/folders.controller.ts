import {
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
} from '@nestjs/common';
import { CreateFolderDto, UpdateFolderDto } from './folder.dto.js';
import { FolderSummary, FoldersService } from './folders.service.js';

// Un identifiant non numérique désigne un dossier qui n'existe pas.
const parseId = new ParseIntPipe({
  exceptionFactory: () => new NotFoundException('Ce dossier n’existe pas.'),
});

@Controller()
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get('ues/:code/folders')
  findAllByUe(@Param('code') code: string): Promise<FolderSummary[]> {
    return this.foldersService.findAllByUe(code);
  }

  @Post('ues/:code/folders')
  create(
    @Param('code') code: string,
    @Body() input: CreateFolderDto,
  ): Promise<FolderSummary> {
    return this.foldersService.create(code, input);
  }

  @Patch('folders/:id')
  update(
    @Param('id', parseId) id: number,
    @Body() changes: UpdateFolderDto,
  ): Promise<FolderSummary> {
    return this.foldersService.update(id, changes);
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', parseId) id: number): Promise<void> {
    return this.foldersService.remove(id);
  }
}
