import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { HazardsService } from './hazards.service';
import {
  HazardEditableFieldsDto,
  HazardListQueryDto,
  HazardListResponseDto,
  HazardResponseDto,
  UpdateHazardDto,
} from './dto/hazard.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';

@Controller('api/v1/hazards')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class HazardsController {
  constructor(private readonly hazards: HazardsService) {}

  @Get()
  list(@Query() q: HazardListQueryDto): Promise<HazardListResponseDto> {
    return this.hazards.list(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<HazardResponseDto> {
    return this.hazards.findOne(id);
  }

  @Get(':id/editable')
  editableFields(@Param('id') id: string): Promise<HazardEditableFieldsDto> {
    return this.hazards.editableFields(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHazardDto,
  ): Promise<HazardResponseDto> {
    return this.hazards.update(id, dto);
  }
}
