import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role, TransferDestinationType, TransferStatus } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { TransfersService } from './transfers.service';

class TransferItemDto {
  @IsInt() variantId: number;
  @IsInt() @Min(1) quantity: number;
}

class CreateTransferDto {
  @IsInt() sourceWarehouseId: number;
  @IsEnum(TransferDestinationType) destinationType: TransferDestinationType;
  @IsOptional() @IsInt() destinationBranchId?: number;
  @IsOptional() @IsInt() thirdPartyId?: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TransferItemDto)
  items: TransferItemDto[];
  @IsOptional() notes?: string;
}

class SendDto { @IsOptional() notes?: string; }

class ConfirmDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ConfirmItemDto)
  items: ConfirmItemDto[];
}

class ConfirmItemDto {
  @IsInt() transferItemId: number;
  @IsInt() @Min(0) receivedQuantity: number;
  @IsOptional() @IsInt() @Min(0) damagedQuantity?: number;
}

@ApiTags('Transferencias')
@ApiBearerAuth('JWT')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const cleanStatus = typeof status === 'string' && Object.values(TransferStatus).includes(status as TransferStatus)
      ? status
      : undefined;
    return this.transfers.list(
      req.user,
      cleanStatus,
      typeof search === 'string' ? search.trim().slice(0, 100) : undefined,
      parsePagination(page, pageSize),
    );
  }


  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.transfers.detail(id, req.user);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  create(@Body() dto: CreateTransferDto, @Req() req: any) {
    return this.transfers.create(dto, req.user);
  }

  @Post(':id/send')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  send(@Param('id', ParseIntPipe) id: number, @Body() dto: SendDto, @Req() req: any) {
    return this.transfers.send(id, dto, req.user);
  }

  // Confirmación obligatoria de recepción (encargado de sucursal destino)
  @Post(':id/confirm')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  confirm(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmDto, @Req() req: any) {
    return this.transfers.confirm(id, dto, req.user);
  }

  @Post(':id/close')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  close(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.transfers.close(id, req.user);
  }
}
