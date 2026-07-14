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
import { ActiveUserGuard, AdminGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

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
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHazardDto,
    @CurrentUser() user: users,
  ): Promise<HazardResponseDto> {
    return this.hazards.update(id, dto, user.id);
  }
}
