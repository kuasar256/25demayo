import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, IsEnum, Min,
} from 'class-validator';
import { Role, ProductionPriority } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProductionService } from './production.service';

class CreateProductionOrderDto {
  @IsInt() @Min(1) variantId: number;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() warehouseId?: number;
  @IsOptional() @IsEnum(ProductionPriority) priority?: string;
  @IsOptional() @IsString() customNotes?: string;
  @IsOptional() @IsDateString({ strict: true }) targetDate?: string;
  @IsOptional() @IsInt() saleId?: number;
}

class UpdateStatusDto {
  @IsNotEmpty() @IsString() status: string;
}

class AssignWorkerDto {
  @IsOptional() @IsInt() assignedToId?: number | null;
}

@ApiTags('Producción')
@ApiBearerAuth('JWT')
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Req() req?: any,
  ) {
    return this.production.list(req.user, {
      branchId: branchId ? +branchId : undefined,
      status,
      priority,
      search,
    });
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  create(@Body() dto: CreateProductionOrderDto, @Req() req: any) {
    return this.production.create(dto, req.user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    return this.production.updateStatus(id, dto.status, req.user);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignWorkerDto,
    @Req() req: any,
  ) {
    return this.production.assign(id, dto.assignedToId ?? null, req.user);
  }
}
