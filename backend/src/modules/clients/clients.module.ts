import { Module } from '@nestjs/common';
import { ClientsController, ThirdPartiesController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController, ThirdPartiesController],
  providers: [ClientsService],
})
export class ClientsModule {}
