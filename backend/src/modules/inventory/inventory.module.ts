import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, NotificationsService],
  exports: [InventoryService],
})
export class InventoryModule {}
