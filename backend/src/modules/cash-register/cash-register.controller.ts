import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CashMovementType, Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CashRegisterService } from './cash-register.service';

class OpenShiftDto {
  @IsNumber()
  @Min(0)
  initialCash: number;
}

class AddMovementDto {
  @IsEnum(CashMovementType)
  type: 'ENTRADA' | 'SALIDA';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;
}

class CloseShiftDto {
  @IsNumber()
  @Min(0)
  actualCash: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Caja')
@ApiBearerAuth('JWT')
@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Get('active')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  getActive(@Req() req: any) {
    return this.service.getActiveShift(req.user);
  }

  @Post('open')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  open(@Body() dto: OpenShiftDto, @Req() req: any) {
    return this.service.openShift(dto.initialCash, req.user);
  }

  @Post(':id/movement')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  addMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMovementDto,
    @Req() req: any,
  ) {
    return this.service.addMovement(id, dto.type, dto.amount, dto.reason, req.user);
  }

  @Post(':id/close')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseShiftDto,
    @Req() req: any,
  ) {
    return this.service.closeShift(id, dto.actualCash, dto.notes, req.user);
  }

  @Get('history')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  history(@Req() req: any) {
    return this.service.listHistory(req.user);
  }
}
