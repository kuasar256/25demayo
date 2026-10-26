import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Min,
  ValidateNested,
} from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { QuotationsService } from './quotations.service';

export class QuotationItemDto {
  @IsInt()
  @Min(1)
  variantId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateQuotationDto {
  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsNotEmpty()
  @IsString()
  clientName: string;

  @IsOptional()
  @IsString()
  clientCi?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  validDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];
}

export class UpdateQuotationStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CONVERTIDA_A_VENTA'])
  status: string; // PENDIENTE | APROBADA | RECHAZADA | CONVERTIDA_A_VENTA
}

@ApiTags('Cotizaciones')
@ApiBearerAuth('JWT')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.quotations.list(search, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.quotations.detail(id);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  create(@Body() dto: CreateQuotationDto, @Req() req: any) {
    return this.quotations.create(dto, req.user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuotationStatusDto,
  ) {
    return this.quotations.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.quotations.delete(id);
  }
}
