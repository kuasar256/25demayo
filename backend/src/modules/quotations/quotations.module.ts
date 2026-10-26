import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
