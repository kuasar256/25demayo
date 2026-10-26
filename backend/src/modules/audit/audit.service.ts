import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(data: {
    userId?: number;
    action: string;
    module: string;
    entity?: string;
    entityId?: number;
    detail?: string;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }
}
