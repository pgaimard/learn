import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CreateUeDto } from './dto/create-ue.dto.js';
import { ReorderUesDto } from './dto/reorder-ues.dto.js';
import { UpdateUeDto } from './dto/update-ue.dto.js';
import { Ue } from './ue.entity.js';
import { UeService } from './ue.service.js';

@Controller('ues')
export class UeController {
  constructor(private readonly ueService: UeService) {}

  @Get()
  findAll(): Promise<Ue[]> {
    return this.ueService.findAll();
  }

  @Put('order')
  reorder(@Body() input: ReorderUesDto): Promise<Ue[]> {
    return this.ueService.reorder(input.codes);
  }

  @Get(':code')
  findOne(@Param('code') code: string): Promise<Ue> {
    return this.ueService.findByCode(code);
  }

  @Post()
  create(@Body() input: CreateUeDto): Promise<Ue> {
    return this.ueService.create(input);
  }

  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body() changes: UpdateUeDto,
  ): Promise<Ue> {
    return this.ueService.update(code, changes);
  }

  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('code') code: string): Promise<void> {
    return this.ueService.remove(code);
  }
}
