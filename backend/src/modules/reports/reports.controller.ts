import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LocationType, Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { ReportsService } from './reports.service';

@ApiTags('Reportes')
@ApiBearerAuth('JWT')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Métricas del dashboard por rol */
  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.reports.dashboard(req.user);
  }

  @Get('sales')
  @Roles(
    Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA,
    Role.ENCARGADO_SUCURSAL, Role.VENDEDOR,
  )
  salesByPeriod(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('locationId') locationId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('locationType') locationType?: string,
    @Req() req?: any,
  ) {
    if (locationId && !/^\d+$/.test(locationId)) {
      throw new BadRequestException('La ubicación seleccionada no es válida.');
    }
    if (sellerId && !/^\d+$/.test(sellerId)) {
      throw new BadRequestException('El vendedor seleccionado no es válido.');
    }
    if (locationType && !Object.values(LocationType).includes(locationType as LocationType)) {
      throw new BadRequestException('El tipo de ubicación no es válido.');
    }
    return this.reports.salesByPeriod(req.user, from, to,
      locationId ? +locationId : undefined, sellerId ? +sellerId : undefined, locationType);
  }

  @Get('top-products')
  @Roles(
    Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA,
    Role.ENCARGADO_SUCURSAL, Role.VENDEDOR,
  )
  topProducts(@Query('limit') limit?: string, @Req() req?: any) {
    return this.reports.topProducts(req.user, limit ? +limit : 10);
  }

  @Get('transfers')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA)
  transfers(@Query('status') status?: string) {
    return this.reports.transfers(status);
  }

  @Get('audit')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  audit(
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (userId && !/^\d+$/.test(userId)) {
      throw new BadRequestException('El identificador de usuario debe ser numérico.');
    }
    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (from && !isValidDate(from)) {
      throw new BadRequestException('La fecha inicial debe ser una fecha válida con formato YYYY-MM-DD.');
    }
    if (to && !isValidDate(to)) {
      throw new BadRequestException('La fecha final debe ser una fecha válida con formato YYYY-MM-DD.');
    }
    if (from && to && from > to) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final.');
    }
    const cleanModule = typeof module === 'string' ? module.trim().slice(0, 50) : undefined;
    return this.reports.audit(
      userId ? +userId : undefined,
      cleanModule,
      from,
      to,
      parsePagination(page, pageSize),
    );
  }
}
