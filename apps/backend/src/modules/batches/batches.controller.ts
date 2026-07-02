import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { BatchesService } from './batches.service';
import {
  BatchImportRequestDto,
  BatchImportResultDto,
  BatchPreviewRequestDto,
  BatchPreviewResponseDto,
  BatchResponseDto,
  ImportErrorResponseDto,
} from './dto/batch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/batches')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 10,
  ): Promise<BatchResponseDto[]> {
    return this.batches.list(page, pageSize);
  }

  @Post('preview')
  preview(@Body() dto: BatchPreviewRequestDto): Promise<BatchPreviewResponseDto> {
    return this.batches.preview(dto);
  }

  @Post('import')
  import(
    @Body() dto: BatchImportRequestDto,
    @CurrentUser() user: users,
  ): Promise<BatchImportResultDto> {
    return this.batches.import(dto, user.id);
  }

  @Get('template')
  async template(@Res() res: Response): Promise<void> {
    const buf = await this.batches.exportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="hazard_batch_template.xlsx"');
    res.send(buf);
  }

  @Get(':id/errors')
  errors(@Param('id') id: string): Promise<ImportErrorResponseDto[]> {
    return this.batches.errors(id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.batches.downloadFile(id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(file.data);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.batches.remove(id);
  }
}
