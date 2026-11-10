import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UeController } from './ue.controller.js';
import { Ue } from './ue.entity.js';
import { UeService } from './ue.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ue])],
  controllers: [UeController],
  providers: [UeService],
  exports: [UeService],
})
export class UeModule {}
