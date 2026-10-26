import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max, NotEquals,
} from 'class-validator';
import { LocationType, Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { InventoryService } from './inventory.service';

class StockQueryDto {
  @IsOptional() @IsEnum(LocationType) locationType?: LocationType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) locationId?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

class EntryDto {
  @IsInt() @Min(1) @Max(2147483647) variantId: number;
  @IsEnum(LocationType) locationType: LocationType;
  @IsInt() @Min(1) @Max(2147483647) locationId: number;
  @IsInt() @Min(1) @Max(2147483647) quantity: number;
  @IsOptional() @IsString() reason?: string;
}

class AdjustDto {
  @IsInt() @Min(1) @Max(2147483647) variantId: number;
  @IsEnum(LocationType) locationType: LocationType;
  @IsInt() @Min(1) @Max(2147483647) locationId: number;
  @IsInt() @Min(-2147483647) @Max(2147483647) @NotEquals(0) quantity: number; // puede ser negativo (salida) o positivo (entrada)
  @IsNotEmpty() @IsString() reason: string; // motivo obligatorio
}

class MovementsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) variantId?: number;
  @IsOptional() @IsEnum(LocationType) locationType?: LocationType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) locationId?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

@ApiTags('Inventario')
@ApiBearerAuth('JWT')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Todos ven stock (alcance por rol se filtra en service según branchId)
  @Get('stock')
  stock(@Query() q: StockQueryDto, @Req() req: any) {
    return this.inventory.stock(q, req.user, parsePagination(q.page, q.pageSize));
  }

  @Get('critical')
  critical(@Req() req: any) {
    return this.inventory.critical(req.user);
  }

  @Get('movements')
  movements(@Query() q: MovementsQueryDto, @Req() req: any) {
    return this.inventory.movements(q, req.user, parsePagination(q.page, q.pageSize));
  }

  // Ingreso de producto terminado (fábrica) y ajustes
  @Post('entries')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  entry(@Body() dto: EntryDto, @Req() req: any) {
    return this.inventory.registerEntry(dto, req.user);
  }

  @Post('adjustments')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA, Role.ENCARGADO_SUCURSAL)
  adjust(@Body() dto: AdjustDto, @Req() req: any) {
    return this.inventory.adjust(dto, req.user);
  }
}
