import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [SalesController],
  providers: [SalesService, InventoryService, NotificationsService],
})
export class SalesModule {}
