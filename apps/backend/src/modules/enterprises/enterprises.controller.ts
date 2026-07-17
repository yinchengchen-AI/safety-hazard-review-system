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
} from '@nestjs/common'
import { MaxIntPipe } from '../../common/pipes/max-int.pipe';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/enterprises')
@UseGuards(JwtAuthGuard, ActiveUserGuard, AdminGuard)
export class EnterprisesController {
  constructor(private readonly enterprises: EnterprisesService) {}

  @Post()
  @HttpCode(201)
  create(
    @Body() dto: CreateEnterpriseDto,
    @CurrentUser() user: users,
  ): Promise<EnterpriseResponseDto> {
    return this.enterprises.create(dto, user.id);
  }

  @Get()
  list(
    @Query('page', new MaxIntPipe({ optional: true })) page = 1,
    @Query('page_size', new MaxIntPipe({ optional: true })) pageSize = 20,
    @Query('keyword') keyword = '',
  ): Promise<EnterpriseListResponseDto> {
    return this.enterprises.list(page, pageSize, keyword);
  }

  @Get('export')
  async export(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="enterprises.xlsx"');
    // P1-2: collection-based export with a hard page cap so the
    // API never pulls the entire enterprise table in a single
    // query. The service paginates internally and writes the
    // workbook in chunks, then returns a single Buffer. For very
    // large datasets we'd add a ?stream=true flag that returns a
    // chunked transfer; for the current scale this is enough to
    // remove the OOM risk while staying simple.
    const buf = await this.enterprises.exportToBuffer();
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
  update(@Param('id') id: string, @Body() dto: UpdateEnterpriseDto): Promise<EnterpriseResponseDto> {
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
