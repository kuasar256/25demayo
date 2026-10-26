import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { LocationsService } from './locations.service';

class CreateWarehouseDto { @IsNotEmpty() @IsString() name: string; }
const DEPARTMENTS = ['Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija'];

class CreateBranchDto {
  @IsOptional() @IsIn(DEPARTMENTS) department?: string | null;
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
}
class UpdateLocationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateBranchDto extends UpdateLocationDto {
  @IsOptional() @IsIn(DEPARTMENTS) department?: string | null;
}

@ApiTags('Ubicaciones')
@ApiBearerAuth('JWT')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('warehouses')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  warehouses() { return this.locations.warehouses(); }

  @Get('branches')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  branches(@Req() req: any, @Query('includeInactive') includeInactive?: string) {
    return this.locations.branches(req.user, includeInactive === 'true');
  }

  @Post('warehouses')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.locations.createWarehouse(dto);
  }

  @Post('branches')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  createBranch(@Body() dto: CreateBranchDto) {
    return this.locations.createBranch(dto);
  }

  @Patch('warehouses/:id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  updateWarehouse(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLocationDto) {
    return this.locations.updateWarehouse(id, dto);
  }

  @Patch('branches/:id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  updateBranch(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto) {
    return this.locations.updateBranch(id, dto);
  }
}
