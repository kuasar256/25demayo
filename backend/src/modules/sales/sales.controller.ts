import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationType, Role, SaleStatus, PaymentMethod, PaymentType, DeliveryStatus, ProductionPriority } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { SalesService } from './sales.service';

class SaleItemDto {
  @IsInt() @Min(1) variantId: number;
  @IsInt() @Min(1) quantity: number;
  @IsNumber() @Min(0) expectedUnitPrice: number;
  @IsOptional() @IsString() warrantySeal?: string;
}

class CreateSaleDto {
  @IsEnum(LocationType) locationType: LocationType;
  @IsInt() @Min(1) locationId: number;
  @IsNotEmpty() @IsString() clientCi: string;
  @IsNotEmpty() @IsString() clientName: string;
  @IsOptional() clientPhone?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemDto)
  items: SaleItemDto[];
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: string;
  @IsOptional() @IsNumber() @Min(0) amountPaid?: number;
  @IsOptional() @IsNumber() @Min(0) changeAmount?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(PaymentType) paymentType?: string;
  @IsOptional() @IsNumber() @Min(0) pendingBalance?: number;
  @IsOptional() @IsEnum(DeliveryStatus) deliveryStatus?: string;
  @IsOptional() @IsDateString({ strict: true }) deliveryDate?: string;
  @IsOptional() @IsBoolean() createProductionOrder?: boolean;
  @IsOptional() @IsString() customNotes?: string;
  @IsOptional() @IsEnum(ProductionPriority) priority?: string;
}

class PayBalanceDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() markDelivered?: boolean;
}

class CancelDto {
  @IsNotEmpty() @IsString() reason: string; // motivo obligatorio
}

@ApiTags('Ventas')
@ApiBearerAuth('JWT')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  list(
    @Query('locationId') locationId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('deliveryStatus') deliveryStatus?: string,
    @Query('hasPendingBalance') hasPendingBalance?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const cleanStatus = status && Object.values(SaleStatus).includes(status as SaleStatus)
      ? status as SaleStatus
      : undefined;
    return this.sales.list(
      req.user,
      locationId ? +locationId : undefined,
      sellerId ? +sellerId : undefined,
      {
        search: typeof search === 'string' ? search.trim().slice(0, 100) : undefined,
        status: cleanStatus,
        deliveryStatus: deliveryStatus || undefined,
        hasPendingBalance: hasPendingBalance === 'true',
        pagination: parsePagination(page, pageSize),
      },
    );
  }

  @Get('warranty')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  checkWarranty(@Query('query') query: string) {
    return this.sales.checkWarranty(query);
  }

  @Get('ranking')
  ranking(@Query('from') from?: string, @Query('to') to?: string, @Req() req?: any) {
    return this.sales.ranking(req.user, from, to);
  }

  @Get(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.sales.detail(id, req.user);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  create(@Body() dto: CreateSaleDto, @Req() req: any) {
    return this.sales.create(dto, req.user);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelDto, @Req() req: any) {
    return this.sales.cancel(id, dto.reason, req.user);
  }

  @Post(':id/pay-balance')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  payBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PayBalanceDto,
    @Req() req: any,
  ) {
    return this.sales.payBalance(id, dto, req.user);
  }

  @Patch(':id/deliver')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  deliver(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.sales.markDelivered(id, req.user);
  }
}
