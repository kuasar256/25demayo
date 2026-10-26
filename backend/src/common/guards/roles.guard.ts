import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Los permisos se aplican en backend (no solo en la interfaz).
 * La matriz completa por módulo está en docs/MATRIZ-PERMISOS.md y se
 * traduce en @Roles() en cada controlador.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No autenticado');
    if (!required.includes(user.role)) {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }
    return true;
  }
}
