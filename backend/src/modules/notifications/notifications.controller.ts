import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: users,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 20,
  ) {
    return this.notifications.list(user.id, page, pageSize);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: users) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(@CurrentUser() user: users, @Param('id') id: string): Promise<void> {
    await this.notifications.markAsRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(204)
  async markAllRead(@CurrentUser() user: users): Promise<void> {
    await this.notifications.markAllAsRead(user.id);
  }
}
