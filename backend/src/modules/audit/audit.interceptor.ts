import {
  CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Auditoría transversal: registra mutaciones (POST/PATCH/DELETE) con
 * quién, qué, cuándo y desde dónea (IP).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = req.user;
    const url: string = req.url || '';
    const module = url.split('/')[2] ?? 'unknown';

    return next.handle().pipe(
      tap((data) => {
        // No bloquear la respuesta por auditoría
        this.prisma.auditLog.create({
          data: {
            userId: user?.id,
            action: method,
            module,
            entity: url.split('/')[3],
            entityId: data?.id,
            detail: JSON.stringify({ url, bodyKeys: Object.keys(req.body ?? {}) }).slice(0, 500),
            ip: req.ip,
          },
        }).catch((error: unknown) => {
          const details = error instanceof Error ? error.stack : String(error);
          this.logger.error(`No se pudo registrar la auditoría para ${method} ${url}.`, details);
        });
      }),
    );
  }
}
