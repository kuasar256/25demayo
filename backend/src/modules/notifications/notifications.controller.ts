import { Controller, Get, Param, ParseIntPipe, Patch, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificaciones')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  my(@Req() req: { user: { id: number } }) {
    return this.notifications.myNotifications(req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: { id: number } }) {
    return this.notifications.unreadCount(req.user.id);
  }

  @Patch('read-all')
  readAll(@Req() req: { user: { id: number } }) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notifications.markRead(req.user.id, id);
  }
}
