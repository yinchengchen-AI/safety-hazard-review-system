import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaxIntPipe } from '../../common/pipes/max-int.pipe';
import { ReviewTasksService } from './review-tasks.service';
import {
  BatchReviewRequestDto,
  CreateReviewTaskDto,
  ReviewTaskDetailResponseDto,
  ReviewTaskListResponseDto,
  ReviewTaskResponseDto,
  ReviewSingleHazardDto,
} from './dto/review-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/review-tasks')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ReviewTasksController {
  constructor(private readonly tasks: ReviewTasksService) {}

  @Post()
  @HttpCode(201)
  create(
    @Body() dto: CreateReviewTaskDto,
    @CurrentUser() user: users,
  ): Promise<ReviewTaskResponseDto> {
    return this.tasks.create(dto, user.id);
  }

  @Get()
  list(
    @Query('page', new MaxIntPipe({ optional: true })) page = 1,
    @Query('page_size', new MaxIntPipe({ optional: true })) pageSize = 10,
    @Query('status') status?: string,
  ): Promise<ReviewTaskListResponseDto> {
    return this.tasks.list(page, pageSize, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ReviewTaskDetailResponseDto> {
    return this.tasks.findOne(id);
  }

  @Post(':id/hazards/:hazardId/review')
  @HttpCode(200)
  review(
    @Param('id') taskId: string,
    @Param('hazardId') hazardId: string,
    @Body() dto: ReviewSingleHazardDto,
    @CurrentUser() user: users,
  ) {
    return this.tasks.reviewHazard(taskId, hazardId, dto, user.id);
  }

  @Post(':id/batch-review')
  @HttpCode(200)
  batchReview(
    @Param('id') taskId: string,
    @Body() dto: BatchReviewRequestDto,
    @CurrentUser() user: users,
  ) {
    return this.tasks.batchReview(taskId, dto, user.id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@Param('id') id: string, @CurrentUser() user: users) {
    return this.tasks.complete(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @CurrentUser() user: users) {
    return this.tasks.cancel(id, user.id);
  }
}
