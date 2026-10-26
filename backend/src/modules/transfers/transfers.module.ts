import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [TransfersController],
  providers: [TransfersService, InventoryService, NotificationsService],
})
export class TransfersModule {}
