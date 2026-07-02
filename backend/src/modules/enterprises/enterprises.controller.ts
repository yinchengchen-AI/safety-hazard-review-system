import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { EnterprisesService } from './enterprises.service';
import {
  CreateEnterpriseDto,
  EnterpriseImportRequestDto,
  EnterpriseImportResultDto,
  EnterpriseListResponseDto,
  EnterpriseResponseDto,
  UpdateEnterpriseDto,
} from './dto/enterprise.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard, AdminGuard } from '../../common/guards';

@Controller('api/v1/enterprises')
@UseGuards(JwtAuthGuard, ActiveUserGuard, AdminGuard)
export class EnterprisesController {
  constructor(private readonly enterprises: EnterprisesService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateEnterpriseDto): Promise<EnterpriseResponseDto> {
    return this.enterprises.create(dto);
  }

  @Get()
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 20,
    @Query('keyword') keyword = '',
  ): Promise<EnterpriseListResponseDto> {
    return this.enterprises.list(page, pageSize, keyword);
  }

  @Get('export')
  async export(@Res() res: Response): Promise<void> {
    const buf = await this.enterprises.exportToBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="enterprises.xlsx"');
    res.send(buf);
  }

  @Get('template')
  async template(@Res() res: Response): Promise<void> {
    const buf = await this.enterprises.exportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="enterprise_template.xlsx"');
    res.send(buf);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EnterpriseResponseDto> {
    return this.enterprises.findOne(id);
  }

  @Get(':id/statistics')
  statistics(@Param('id') id: string) {
    return this.enterprises.statistics(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnterpriseDto,
  ): Promise<EnterpriseResponseDto> {
    return this.enterprises.update(id, dto);
  }

  @Post('import')
  import(@Body() dto: EnterpriseImportRequestDto): Promise<EnterpriseImportResultDto> {
    return this.enterprises.importRows(dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.enterprises.remove(id);
  }
}
