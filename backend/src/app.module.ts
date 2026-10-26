import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { LocationsModule } from './modules/locations/locations.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { SalesModule } from './modules/sales/sales.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadModule } from './modules/upload/upload.module';
import { CashRegisterModule } from './modules/cash-register/cash-register.module';
import { ProductionModule } from './modules/production/production.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './modules/audit/audit.interceptor';

import { getJwtSecret } from './common/jwt-secret';

const jwtSecret = getJwtSecret();

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '12h') as any },
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    LocationsModule,
    InventoryModule,
    TransfersModule,
    SalesModule,
    ClientsModule,
    ReportsModule,
    AuditModule,
    NotificationsModule,
    UploadModule,
    CashRegisterModule,
    ProductionModule,
    QuotationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
