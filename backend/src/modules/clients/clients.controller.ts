import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { ClientsService } from './clients.service';

class UpsertClientDto {
  @IsNotEmpty() @IsString() ci: string;
  @IsNotEmpty() @IsString() fullName: string;
  @IsOptional() @IsString() phone?: string;
}

class UpdateClientDto {
  @IsOptional() @IsString() ci?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
}

class CreateThirdPartyDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() nit?: string;
}

class UpdateThirdPartyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() isActive?: boolean;
}


@ApiTags('Clientes')
@ApiBearerAuth('JWT')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  /** Búsqueda por CI para autocompletado en ventas */
  @Get('search')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  search(@Query('ci') ci?: string) {
    const cleanCi = typeof ci === 'string' ? ci.trim().slice(0, 50) : '';
    return this.clients.searchByCi(cleanCi);
  }

  @Get()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const cleanSearch = typeof search === 'string' ? search.trim().slice(0, 100) : undefined;
    return this.clients.list(cleanSearch, parsePagination(page, pageSize));
  }


  @Get(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.clients.detail(id, req.user);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  upsert(@Body() dto: UpsertClientDto) {
    return this.clients.upsert(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }
}

@ApiTags('Proveedores y Terceros')
@ApiBearerAuth('JWT')
@Controller('third-parties')
export class ThirdPartiesController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA, Role.ENCARGADO_SUCURSAL, Role.VENDEDOR)
  list(@Query('type') type?: string, @Query('category') category?: string) {
    return this.clients.thirdParties(type, category);
  }

  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  create(@Body() dto: CreateThirdPartyDto) {
    return this.clients.createThirdParty(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateThirdPartyDto) {
    return this.clients.updateThirdParty(id, dto);
  }
}
